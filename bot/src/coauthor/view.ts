import type { CoauthorChat, CoauthorFeedItem } from "@tg-rp-bot/shared";
import type { Card } from "../db/schema.js";
import { orderedCards, toCardView } from "./card-data.js";
import type { CoauthorChatRecord } from "./coauthor.repository.js";
import type { TurnProgress } from "./turn-progress.js";
import { buildFeed } from "./turn/feed.js";

/**
 * Чат для клиента. Правки отдаются только по карточкам, которые ещё в чате: у удалённой карточки
 * их всё равно не применить. lastError — только когда хода сейчас нет.
 *
 * Пока ход идёт, в БД его ещё нет: лента и правки берутся из состояния хода (progress). Шаги этого хода
 * отдаются отдельно, liveSteps — они полнее (видны и те, что ещё пишутся), а из ленты убираются, чтобы не двоиться.
 */
export function toChatView(
  record: CoauthorChatRecord,
  cards: Card[],
  running: boolean,
  lastError?: string,
  progress?: TurnProgress,
): CoauthorChat {
  const visible = orderedCards(record.cardIds, cards);
  const visibleIds = new Set(visible.map((c) => c.id));
  const state = progress?.state ?? record.state;
  return {
    id: record.id,
    name: record.name,
    cardIds: record.cardIds,
    cards: visible.map(toCardView),
    presetId: record.presetId,
    systemPrompt: record.systemPrompt,
    useWebSearch: record.useWebSearch,
    useImages: record.useImages,
    maxRounds: record.maxRounds,
    maxEdits: record.maxEdits,
    maxQuestions: record.maxQuestions,
    feed: progress ? withoutCurrentSteps(buildFeed(state)) : buildFeed(state),
    proposals: state.proposals.filter((p) => visibleIds.has(p.cardId)),
    running,
    ...(progress && { liveSteps: progress.steps }),
    ...(!running && lastError && { lastError }),
  };
}

/** Лента без шагов текущего хода — тех, что после последнего сообщения пользователя. */
function withoutCurrentSteps(feed: CoauthorFeedItem[]): CoauthorFeedItem[] {
  const lastUser = feed.findLastIndex((item) => item.kind === "user");
  return feed.filter((item, i) => i < lastUser || item.kind !== "steps");
}
