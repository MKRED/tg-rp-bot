import type { CoauthorProposal } from "@tg-rp-bot/shared";
import { countTokens } from "../../../utils/tokens.js";
import type { CoauthorCardData } from "../prompt.js";
import type { StoredMessage } from "../state.js";
import { trimHistory } from "../trim.js";
import { replayCardResults, type ReplayedCardResult } from "./replay.js";

export interface VisibleHistory {
  /** История, которая уходит модели (обрезана по ходам, начинается с user). */
  history: StoredMessage[];
  /** Как реплеить результаты чтения карточек в ней. */
  cardResults: Map<string, ReplayedCardResult>;
}

/**
 * Окно истории, которое видит модель. Обрезка считает устаревший результат get_card по размеру заглушки, а
 * не по хранимому тексту карточки: иначе мёртвый текст, которого модель не видит, вытеснял бы живую
 * переписку. Реплей по всей истории и по оставленному хвосту совпадает: хвост всегда содержит последний ход,
 * а более поздний результат той же карточки лежит в нём, если там есть ранний.
 * Одно окно — и для запроса, и для проверки «карточка прочитана», и для list_cards: если бы они расходились,
 * модель получила бы «не прочитана» про карточку, которую видит.
 */
export function visibleHistory(
  messages: StoredMessage[],
  cards: CoauthorCardData[],
  proposals: CoauthorProposal[],
  budget: number,
): VisibleHistory {
  const all = replayCardResults(messages, cards, proposals);
  const history = trimHistory(messages, budget, (m) => {
    if (m.role !== "tool") return undefined;
    const replay = all.get(m.toolCallId);
    return replay?.kind === "stub" ? countTokens(replay.text) : undefined;
  });
  // Только результаты из окна: срезанное чтение карточки модель уже не видит — карточка не прочитана.
  const cardResults = new Map<string, ReplayedCardResult>();
  for (const m of history) {
    const replay = m.role === "tool" ? all.get(m.toolCallId) : undefined;
    if (m.role === "tool" && replay) cardResults.set(m.toolCallId, replay);
  }
  return { history, cardResults };
}
