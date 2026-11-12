import type { CoauthorProposal } from "@tg-rp-bot/shared";
import type { CoauthorCardData } from "../prompt.js";
import type { StoredMessage } from "../state.js";
import { GET_CARD_TOOL_NAME, LEGACY_GET_CARDS_TOOL_NAME } from "../tools.js";
import { cardStub, cardVersion, parseCardResult } from "./render.js";

/** Как отдать модели сохранённый результат чтения карточки: как есть (с картинками) или заглушкой. */
export type ReplayedCardResult = { kind: "current"; card: CoauthorCardData } | { kind: "stub"; text: string };

/**
 * Результаты get_card в видимой истории → как их реплеить. Заглушкой заменяется результат прошлых ходов,
 * если карточка с тех пор изменилась без участия модели (версия, render.ts), её убрали из чата или есть
 * более поздний результат той же карточки. Результаты текущего хода не трогаются никогда: внутри хода
 * запросы должны совпадать побайтно с предыдущими (кэш провайдера, иначе картинки оплачиваются заново на
 * каждом раунде), а карточки во время хода не меняются — ревью правок заблокировано локом чата.
 * Результаты старого get_cards (чаты до list_cards/get_card) — всегда заглушка: их текст обещал, что
 * снимок карточек актуален, а это уже не так.
 */
export function replayCardResults(
  history: StoredMessage[],
  cards: CoauthorCardData[],
  proposals: CoauthorProposal[],
): Map<string, ReplayedCardResult> {
  const names = new Map<string, string>();
  for (const m of history) if ("toolCalls" in m) for (const c of m.toolCalls) names.set(c.id, c.function.name);
  const turnStart = history.findLastIndex((m) => m.role === "user");

  // Последний результат каждой карточки в прошлых ходах — остальные прошлые вытеснены им.
  const latest = new Map<number, string>();
  history.forEach((m, i) => {
    if (i > turnStart || m.role !== "tool" || names.get(m.toolCallId) !== GET_CARD_TOOL_NAME) return;
    const parsed = parseCardResult(m.content);
    if (parsed) latest.set(parsed.cardId, m.toolCallId);
  });

  const replay = new Map<string, ReplayedCardResult>();
  history.forEach((m, i) => {
    if (m.role !== "tool") return;
    const name = names.get(m.toolCallId);
    if (name === LEGACY_GET_CARDS_TOOL_NAME) {
      replay.set(m.toolCallId, { kind: "stub", text: cardStub.legacy });
      return;
    }
    if (name !== GET_CARD_TOOL_NAME) return;
    const parsed = parseCardResult(m.content);
    if (!parsed) return; // ошибка вызова — реплеится как есть
    const card = cards.find((c) => c.id === parsed.cardId);
    let stub: string | undefined;
    if (!card) stub = cardStub.removed(parsed.cardId);
    else if (i < turnStart && parsed.version !== cardVersion(card, proposals)) stub = cardStub.stale(parsed.cardId);
    else if (i < turnStart && latest.get(parsed.cardId) !== m.toolCallId) stub = cardStub.superseded(parsed.cardId);
    replay.set(m.toolCallId, card && stub === undefined ? { kind: "current", card } : { kind: "stub", text: stub! });
  });
  return replay;
}

/** Карточки, актуальный текст которых модель видит в контексте: только их можно править. */
export function loadedCardIds(replay: Map<string, ReplayedCardResult>): Set<number> {
  const ids = new Set<number>();
  for (const r of replay.values()) if (r.kind === "current") ids.add(r.card.id);
  return ids;
}
