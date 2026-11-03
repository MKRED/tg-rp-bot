import type { CoauthorChat } from "@tg-rp-bot/shared";
import type { Card } from "../db/schema.js";
import { orderedCards, toCardView } from "./card-data.js";
import type { CoauthorChatRecord } from "./coauthor.repository.js";
import { buildFeed } from "./turn/feed.js";

/**
 * Чат для клиента. Правки отдаются только по карточкам, которые ещё в чате: у удалённой карточки
 * их всё равно не применить. lastError — только когда хода сейчас нет.
 */
export function toChatView(record: CoauthorChatRecord, cards: Card[], running: boolean, lastError?: string): CoauthorChat {
  const visible = orderedCards(record.cardIds, cards);
  const visibleIds = new Set(visible.map((c) => c.id));
  return {
    id: record.id,
    name: record.name,
    cardIds: record.cardIds,
    cards: visible.map(toCardView),
    presetId: record.presetId,
    systemPrompt: record.systemPrompt,
    useAskUser: record.useAskUser,
    useWebSearch: record.useWebSearch,
    useImages: record.useImages,
    feed: buildFeed(record.state),
    proposals: record.state.proposals.filter((p) => visibleIds.has(p.cardId)),
    running,
    ...(!running && lastError && { lastError }),
  };
}
