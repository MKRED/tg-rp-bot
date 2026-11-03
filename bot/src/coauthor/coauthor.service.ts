import { BadRequestException, ConflictException, HttpException, Injectable, NotFoundException } from "@nestjs/common";
import {
  MAX_COAUTHOR_CHATS_PER_USER,
  type CoauthorChat,
  type CoauthorChatInput,
  type CoauthorChatListItem,
  type CoauthorError,
  type CoauthorReviewInput,
  type CoauthorReviewResult,
} from "@tg-rp-bot/shared";
import { tryLockCard, unlockCard } from "../cards/card-lock.js";
import { CardsRepository } from "../cards/cards.repository.js";
import { found } from "../common/found.js";
import logger from "../logger.js";
import { PresetsRepository } from "../presets/presets.repository.js";
import { orderedCards, toCardData } from "./card-data.js";
import { getTurnError, isChatLocked, tryLockChat, unlockChat } from "./chat-lock.js";
import { CoauthorRepository, type CoauthorChatRecord } from "./coauthor.repository.js";
import { dropOrphanedProposals, reviewNote } from "./turn/proposals.js";
import { emptyCoauthorState } from "./turn/state.js";
import { toChatView } from "./view.js";

/** Отказ с кодом в `{ error }` (контракт webapp). */
export function refuse(status: 400 | 404 | 409, reason: CoauthorError): HttpException {
  return new HttpException(reason, status);
}

/** Чаты соавтора: CRUD, настройки и решения по правкам. Сам ход ИИ — CoauthorTurnService. */
@Injectable()
export class CoauthorService {
  constructor(
    private readonly repository: CoauthorRepository,
    private readonly cards: CardsRepository,
    private readonly presets: PresetsRepository,
  ) {}

  async list(userId: string): Promise<CoauthorChatListItem[]> {
    const [rows, cards] = await Promise.all([this.repository.list(userId), this.cards.list(userId)]);
    const names = new Map(cards.map((c) => [c.id, c.name]));
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      cardNames: row.cardIds.flatMap((id) => names.get(id) ?? []),
      updatedAt: row.updatedAt.toISOString(),
    }));
  }

  async get(userId: string, id: number): Promise<CoauthorChat> {
    return this.view(userId, found(await this.repository.findOne(userId, id)));
  }

  async create(userId: string, input: CoauthorChatInput): Promise<CoauthorChat> {
    await this.assertInputOwned(userId, input);
    if ((await this.repository.count(userId)) >= MAX_COAUTHOR_CHATS_PER_USER) {
      throw new BadRequestException(`Chat limit reached (max ${MAX_COAUTHOR_CHATS_PER_USER})`);
    }
    return this.view(userId, await this.repository.create(userId, input));
  }

  /** Настройки чата. Правки карточек, убранных из чата, снимаются — принять их уже негде. */
  async update(userId: string, id: number, input: CoauthorChatInput): Promise<CoauthorChat> {
    await this.assertInputOwned(userId, input);
    // Чат для ответа собирается после снятия лока — иначе в нём был бы running: true (то же ниже).
    const saved = await this.withLock(id, async () => {
      const chat = found(await this.repository.findOne(userId, id));
      const state = structuredClone(chat.state);
      dropOrphanedProposals(state, orderedCards(input.cardIds, await this.cards.findMany(userId, input.cardIds)).map(toCardData));
      return found(await this.repository.update(userId, id, input, state));
    });
    return this.view(userId, saved);
  }

  async remove(userId: string, id: number): Promise<void> {
    if (isChatLocked(id)) throw refuse(409, "busy");
    if (!(await this.repository.delete(userId, id))) throw new NotFoundException("Not found");
  }

  /** «Очистить переписку»: история, вопросы и непринятые правки; карточки не трогаются. */
  async clear(userId: string, id: number): Promise<CoauthorChat> {
    const saved = await this.withLock(id, async () => {
      const chat = found(await this.repository.findOne(userId, id));
      return found(await this.repository.saveState(userId, id, emptyCoauthorState(chat.state.nextProposalId)));
    });
    return this.view(userId, saved);
  }

  /**
   * Принять или отклонить правки. Принятие пишет блок в карточку под card-lock (тот же, что у
   * формы карточки и генерации) и только если блок с момента предложения не меняли: иначе правка
   * молча затёрла бы чужие изменения — такие возвращаются в stale и остаются ожидающими. Карточка,
   * занятая другой операцией (сохранение формы, генерация блока), пропускается в busy и тоже остаётся
   * ожидающей. Состояние пишется в любом случае: часть правок уже могла попасть в карточки.
   * Решения копятся в reviewNotes и уйдут модели со следующим сообщением пользователя.
   */
  async review(userId: string, id: number, input: CoauthorReviewInput): Promise<CoauthorReviewResult> {
    const t0 = Date.now();
    const stale: string[] = [];
    const busy: string[] = [];
    let applied = 0;
    const saved = await this.withLock(id, async () => {
      const chat = found(await this.repository.findOne(userId, id));
      const state = structuredClone(chat.state);
      const cards = orderedCards(chat.cardIds, await this.cards.findMany(userId, chat.cardIds));

      for (const proposal of state.proposals) {
        if (proposal.status !== "pending" || !input.proposalIds.includes(proposal.id)) continue;
        const card = cards.find((c) => c.id === proposal.cardId);
        const block = card?.categories.find((c) => c.id === proposal.blockId);
        if (!card || !block) continue;

        if (input.accept) {
          const outcome = await this.applyProposal(userId, card.id, block.id, proposal.baseContent, proposal.content);
          if (outcome === "busy") busy.push(proposal.id);
          if (outcome === "stale") stale.push(proposal.id);
          if (outcome !== "applied") continue;
        }
        proposal.status = input.accept ? "accepted" : "rejected";
        state.reviewNotes.push(reviewNote(input.accept, card.name, block.title));
        applied++;
      }
      return found(await this.repository.saveState(userId, id, state));
    });
    logger.info(
      { durationMs: Date.now() - t0, userId, id, accept: input.accept, applied, stale: stale.length, busy: busy.length },
      "Coauthor proposals reviewed",
    );
    return { chat: await this.view(userId, saved), stale, busy };
  }

  /** Пишет правку в блок карточки, если блок всё ещё такой, каким его видела модель. */
  private async applyProposal(
    userId: string,
    cardId: number,
    blockId: string,
    baseContent: string,
    content: string,
  ): Promise<"applied" | "stale" | "busy"> {
    if (!tryLockCard(cardId)) return "busy";
    try {
      const fresh = (await this.cards.findOne(userId, cardId))?.categories.find((c) => c.id === blockId);
      if (!fresh || fresh.content !== baseContent) return "stale";
      // undefined — карточку удалили между чтением и записью: правку не считаем принятой.
      return (await this.cards.setCategoryContent(userId, cardId, blockId, content)) ? "applied" : "stale";
    } finally {
      unlockCard(cardId);
    }
  }

  /** Чат для клиента — с карточками в текущем состоянии. */
  async view(userId: string, chat: CoauthorChatRecord): Promise<CoauthorChat> {
    const cards = await this.cards.findMany(userId, chat.cardIds);
    return toChatView(chat, cards, isChatLocked(chat.id), getTurnError(chat.id));
  }

  private async withLock<T>(id: number, work: () => Promise<T>): Promise<T> {
    if (!tryLockChat(id)) throw refuse(409, "busy");
    try {
      return await work();
    } finally {
      unlockChat(id);
    }
  }

  /** Пресет и карточки обязаны принадлежать пользователю (чужой id прошёл бы FK или молча пропал). */
  private async assertInputOwned(userId: string, input: CoauthorChatInput): Promise<void> {
    if (input.presetId !== null && !(await this.presets.findOne(userId, input.presetId))) {
      throw new NotFoundException("Preset not found");
    }
    const cards = await this.cards.findMany(userId, input.cardIds);
    if (cards.length !== new Set(input.cardIds).size) throw new NotFoundException("Card not found");
    if (cards.length === 0) throw refuse(400, "no_cards");
  }
}
