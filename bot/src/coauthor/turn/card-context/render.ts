import { createHash } from "node:crypto";
import type { CoauthorProposal } from "@tg-rp-bot/shared";
import { blockPath } from "../apply-patch/index.js";
import type { CoauthorCardData } from "../prompt.js";

/**
 * Версия карточки для модели: меняется, когда карточка изменилась без её участия, — пользователь принял или
 * отклонил правку, поменял карточку в редакторе, картинки. Свои ожидающие правки модели в версию НЕ входят:
 * она их сделала и о них знает, а иначе каждая правка делала бы прочитанную карточку устаревшей посреди хода
 * и заставляла перечитывать её вместе с картинками.
 */
export function cardVersion(card: CoauthorCardData, proposals: CoauthorProposal[]): string {
  const decided = proposals
    .filter((p) => p.cardId === card.id && (p.status === "accepted" || p.status === "rejected"))
    .map((p) => `${p.id}:${p.status}`)
    .sort();
  const hash = createHash("sha256");
  hash.update(JSON.stringify({ name: card.name, brief: card.brief, blocks: card.blocks, decided }));
  for (const image of card.images) hash.update(createHash("sha256").update(image).digest());
  return hash.digest("hex").slice(0, 12);
}

/**
 * Текст результата get_card. Хранится в истории как есть и реплеится побайтно (кэш провайдера); картинки в
 * историю не пишутся — их прикладывает сборка запроса из текущей карточки (replay.ts), пока версия совпадает.
 */
export function renderCard(card: CoauthorCardData, proposals: CoauthorProposal[]): string {
  const pending = new Map(
    proposals.filter((p) => p.status === "pending" && p.cardId === card.id).map((p) => [p.blockId, p.content]),
  );
  return JSON.stringify({
    card_id: card.id,
    version: cardVersion(card, proposals),
    name: card.name,
    brief: card.brief,
    reference_images: card.images.length,
    blocks: card.blocks.map((b) => {
      const proposal = pending.get(b.id);
      return {
        block_id: b.id,
        path: blockPath(card.id, b.id),
        title: b.title,
        format: b.format,
        content: b.content,
        ...(proposal !== undefined && { pending_proposal: proposal }),
      };
    }),
  });
}

/**
 * Результат list_cards: что открыто, без текста блоков — его модель читает get_card по нужным карточкам.
 * read — актуальный результат get_card этой карточки уже есть в разговоре: без подсказки модель перечитывает
 * карточки на каждом ходе «на всякий случай» (проверено вживую), а это текст и картинки заново.
 */
export function renderCardList(cards: CoauthorCardData[], loaded: Set<number> = new Set()): string {
  return JSON.stringify({
    cards: cards.map((card) => ({
      card_id: card.id,
      name: card.name,
      reference_images: card.images.length,
      ...(loaded.has(card.id) && { read: true }),
      blocks: card.blocks.map((b) => ({ block_id: b.id, title: b.title, written: b.content.trim() !== "" })),
    })),
    note:
      "Read a card with get_card before editing it. read: true — your earlier get_card result for this card is " +
      "still current (plus your own proposals since), no need to read it again.",
  });
}

/** card_id и версия из сохранённого результата get_card; ошибка или чужой формат — undefined. */
export function parseCardResult(content: string): { cardId: number; version: string } | undefined {
  try {
    const parsed = JSON.parse(content) as { card_id?: unknown; version?: unknown };
    return typeof parsed.card_id === "number" && typeof parsed.version === "string"
      ? { cardId: parsed.card_id, version: parsed.version }
      : undefined;
  } catch {
    return undefined;
  }
}

/** Заглушки вместо результатов get_card, которые модели видеть уже не нужно или вредно. */
export const cardStub = {
  stale: (cardId: number) =>
    JSON.stringify({
      card_id: cardId,
      note:
        "Outdated: this card changed after this result (the user reviewed your edits or edited the card). " +
        "Call get_card again before editing it.",
    }),
  superseded: (cardId: number) =>
    JSON.stringify({ card_id: cardId, note: "Superseded by a later get_card result for this card." }),
  removed: (cardId: number) => JSON.stringify({ card_id: cardId, note: "This card is no longer open in the workshop." }),
  legacy: JSON.stringify({ note: "Result of a removed tool. Use list_cards and get_card to read the cards." }),
};
