import { BadRequestException, HttpException, Injectable, type MessageEvent } from "@nestjs/common";
import {
  modelSupportsImages,
  SSE_EVENTS,
  type CoauthorAnswerInput,
  type CoauthorStep,
  type CoauthorStepEvent,
  type CoauthorStreamError,
} from "@tg-rp-bot/shared";
import type { Observable } from "rxjs";
import { CardsRepository } from "../cards/cards.repository.js";
import { found } from "../common/found.js";
import { sseObservable } from "../common/sse-observable.js";
import { type SseSink, writeEvent } from "../common/stream-completion.js";
import { MissingApiKeyError } from "../llm/errors.js";
import { LlmService } from "../llm/llm.service.js";
import logger from "../logger.js";
import { PresetsRepository } from "../presets/presets.repository.js";
import { presetToCompletionOptions } from "../prompt/promptBuilder/index.js";
import { LlmSettingsRepository } from "../settings/llm/llm-settings.repository.js";
import { WebSearchSettingsRepository } from "../settings/web-search/web-search-settings.repository.js";
import { WebSearchService } from "../web-search/web-search.service.js";
import { orderedCards, toCardData } from "./card-data.js";
import { clearTurnError, setTurnError, tryLockChat, unlockChat } from "./chat-lock.js";
import { CoauthorRepository, type CoauthorChatRecord } from "./coauthor.repository.js";
import { CoauthorService, refuse } from "./coauthor.service.js";
import { clearTurnProgress, dropRunningTurnSteps, recordTurnStep, startTurnProgress } from "./turn-progress.js";
import { dropOrphanedProposals } from "./turn/proposals.js";
import { askUserResult, resolvePendingQuestions } from "./turn/questions.js";
import type { CoauthorState } from "./turn/state.js";
import { runCoauthorTurn } from "./turn/turn-loop.js";

/**
 * Нижняя граница max_tokens хода: edit_block несёт весь текст блока в аргументах, и с маленьким
 * лимитом пресета (1–2k на reasoning + ответ) аргументы обрезались бы на полуслове — битый JSON.
 */
const MIN_TURN_MAX_TOKENS = 16_000;

/**
 * Как часто слать ping в поток. Раунд с мышлением может молчать долго (reasoning клиенту не уходит), а
 * edge-nginx обрывает соединение без данных по таймауту чтения.
 */
const PING_MS = 15_000;

type PreparedTurn = Awaited<ReturnType<CoauthorTurnService["prepare"]>>;

/**
 * Ход ИИ в чате соавтора: сообщение пользователя или ответ на вопросы → цикл инструментов
 * (turn/turn-loop.ts) → сохранение. Лок чата держится весь ход: GET в это время отдаёт running.
 * Ход доводится и сохраняется, даже если клиент ушёл (обновил страницу) — он подхватит результат опросом.
 * Упавший ход не сохраняет ничего: история остаётся валидной, а текст сообщения клиент вернёт в поле.
 *
 * Две фазы, как в генерации RP-чата: проверки — до возврата потока (ошибки уходят обычным JSON с кодом),
 * сам ход — в потоке. Лок снимает та фаза, где случилось завершение: finally вокруг возврата потока
 * сработал бы до старта хода, и второй запрос пошёл бы по тому же состоянию параллельно.
 */
@Injectable()
export class CoauthorTurnService {
  constructor(
    private readonly repository: CoauthorRepository,
    private readonly chats: CoauthorService,
    private readonly cards: CardsRepository,
    private readonly presets: PresetsRepository,
    private readonly llmSettings: LlmSettingsRepository,
    private readonly webSearchSettings: WebSearchSettingsRepository,
    private readonly llm: LlmService,
    private readonly webSearch: WebSearchService,
  ) {}

  /** Новое сообщение. Если ИИ ждал ответа на вопросы — они считаются пропущенными. */
  send(userId: string, chatId: number, text: string): Promise<Observable<MessageEvent>> {
    return this.turn(userId, chatId, (state) => {
      if (state.pending) resolvePendingQuestions(state, askUserResult(state.pending, { skipped: true })!);
      const review = state.reviewNotes.join("; ");
      state.messages.push({ role: "user", content: text, ...(review && { review }) });
      state.reviewNotes = [];
    });
  }

  /** Ответ на вопросы ИИ — ход продолжается с того же места. */
  answer(userId: string, chatId: number, input: CoauthorAnswerInput): Promise<Observable<MessageEvent>> {
    return this.turn(userId, chatId, (state) => {
      if (!state.pending) throw refuse(404, "no_pending_question");
      const result = askUserResult(state.pending, input);
      if (result === null) throw refuse(400, "answers_mismatch");
      resolvePendingQuestions(state, result);
    });
  }

  private async turn(
    userId: string,
    chatId: number,
    prepare: (state: CoauthorState) => void,
  ): Promise<Observable<MessageEvent>> {
    if (!tryLockChat(chatId)) throw refuse(409, "busy");
    clearTurnError(chatId);
    let prepared: PreparedTurn;
    try {
      prepared = await this.prepare(userId, chatId, prepare);
    } catch (err) {
      unlockChat(chatId);
      const httpError = toHttpError(err, userId, chatId);
      setTurnError(chatId, errorCode(httpError));
      throw httpError;
    }
    return sseObservable("coauthor turn", (sink) => this.run(sink, userId, chatId, prepared));
  }

  /** Всё, что может отказать без вызова модели. Нет ключа — тоже здесь: иначе ошибка пришла бы уже из потока. */
  private async prepare(userId: string, chatId: number, prepare: (state: CoauthorState) => void) {
    const chat = found(await this.repository.findOne(userId, chatId));
    if (chat.presetId == null) throw refuse(400, "preset_required");
    const preset = await this.presets.findOne(userId, chat.presetId);
    if (!preset) throw refuse(400, "preset_required");
    const cards = orderedCards(chat.cardIds, await this.cards.findMany(userId, chat.cardIds)).map(toCardData);
    if (cards.length === 0) throw refuse(400, "no_cards");

    const state = structuredClone(chat.state);
    prepare(state);
    dropOrphanedProposals(state, cards);

    const apiKey = await this.llmSettings.getDecryptedApiKey(userId);
    if (!apiKey) throw new MissingApiKeyError();
    const { maxSearchRounds } = await this.webSearchSettings.get(userId);
    return { chat, preset, cards, state, apiKey, maxSearchRounds };
  }

  private async run(sink: SseSink, userId: string, chatId: number, turn: PreparedTurn): Promise<void> {
    const { chat, preset, cards, state, apiKey, maxSearchRounds } = turn;
    const t0 = Date.now();
    const cardIds = new Set(cards.map((c) => c.id));
    // Запись в поток — fire-and-forget: клиент мог уйти, а ход всё равно доводится и сохраняется.
    const emit = (event: string, payload: unknown) => void writeEvent(sink, event, payload).catch(() => {});
    const ping = setInterval(() => emit(SSE_EVENTS.ping, {}), PING_MS);
    startTurnProgress(chatId, state);

    let saved: CoauthorChatRecord | undefined;
    let failure: string | undefined;
    try {
      const options = presetToCompletionOptions(preset);
      const outcome = await runCoauthorTurn({
        llm: this.llm,
        baseOptions: {
          userId,
          debugLabel: "coauthor",
          ...options,
          maxTokens: Math.max(options.maxTokens ?? 0, MIN_TURN_MAX_TOKENS),
        },
        customPrompt: chat.systemPrompt,
        cards,
        state,
        webSearch: chat.useWebSearch ? { search: (query) => this.webSearch.search(apiKey, query) } : null,
        maxSearchRounds,
        askUserEnabled: chat.useAskUser,
        // Модель без зрения не падает, а молча выкидывает картинки — просто их не шлём (чат полезен и без них).
        withImages: chat.useImages && modelSupportsImages(preset.model),
        onStep: (step: CoauthorStep) => {
          recordTurnStep(chatId, step);
          const payload: CoauthorStepEvent = {
            step,
            ...(step.kind === "edit" && step.status === "done" && { proposals: state.proposals.filter((p) => cardIds.has(p.cardId)) }),
          };
          emit(SSE_EVENTS.step, payload);
        },
        onToken: (text) => emit(SSE_EVENTS.token, { text }),
        onReset: () => {
          dropRunningTurnSteps(chatId);
          emit(SSE_EVENTS.reset, {});
        },
      });

      saved = found(await this.repository.saveState(userId, chatId, state));
      logger.info(
        { durationMs: Date.now() - t0, userId, chatId, outcome, proposals: state.proposals.filter((p) => p.status === "pending").length },
        "Coauthor turn saved",
      );
    } catch (err) {
      failure = errorCode(toHttpError(err, userId, chatId));
      setTurnError(chatId, failure);
    } finally {
      clearInterval(ping);
      clearTurnProgress(chatId);
      unlockChat(chatId);
    }

    // Чат для клиента — после снятия лока, иначе в нём был бы running: true.
    if (saved) {
      await writeEvent(sink, SSE_EVENTS.done, { chat: await this.chats.view(userId, saved) });
    } else {
      const payload: CoauthorStreamError = { code: failure ?? "turn_failed" };
      await writeEvent(sink, SSE_EVENTS.error, payload);
    }
  }
}

function errorCode(err: unknown): string {
  if (!(err instanceof HttpException)) return "turn_failed";
  const body = err.getResponse();
  if (typeof body === "string") return body;
  const code = (body as { error?: unknown }).error;
  return typeof code === "string" ? code : "turn_failed";
}

/** Нет ключа DeepSeek — 400 no_api_key с подсказкой, как у остальных генераций; прочее как есть. */
function toHttpError(err: unknown, userId: string, chatId: number): unknown {
  if (!(err instanceof MissingApiKeyError)) {
    if (!(err instanceof HttpException)) logger.error({ err, userId, chatId }, "Coauthor turn failed");
    return err;
  }
  logger.warn({ userId, chatId }, "Coauthor turn: не задан ключ DeepSeek");
  return new BadRequestException({ error: "no_api_key", message: err.message });
}
