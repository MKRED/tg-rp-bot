import type { StoryMessage } from "@tg-rp-bot/shared";
import { selectValidChain } from "../../prompt/compactionPlan.js";
import type { CompactionRow } from "./compactions.repository.js";

/**
 * Делит активный путь истории пересказами: валидная цепочка пересказов этого пути и живой хвост —
 * сообщения после последнего якоря (весь путь, если пересказов нет или якорь не на пути).
 */
export function splitByCompactions(
  messages: StoryMessage[],
  compactions: CompactionRow[],
): { chain: CompactionRow[]; liveTail: StoryMessage[] } {
  const chain = selectValidChain(compactions, new Set(messages.map((m) => m.id)));
  const lastAnchorId = chain.at(-1)?.toAnchorId;
  const anchorIdx = lastAnchorId != null ? messages.findIndex((m) => m.id === lastAnchorId) : -1;
  return { chain, liveTail: anchorIdx >= 0 ? messages.slice(anchorIdx + 1) : messages };
}
