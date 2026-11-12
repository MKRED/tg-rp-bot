import type { CoauthorProposal } from "@tg-rp-bot/shared";
import { applyHunks, parseBlockPath, parsePatch, type PatchHunk } from "./apply-patch/index.js";
import type { CoauthorCardData } from "./prompt.js";
import { proposeEdit } from "./proposals.js";
import type { CoauthorState } from "./state.js";

export interface PatchOutcome {
  /** Результат вызова для модели. */
  content: string;
  proposals: CoauthorProposal[];
}

const failure = (message: string): PatchOutcome => ({ content: JSON.stringify({ error: message }), proposals: [] });

interface BlockTarget {
  path: string;
  cardId: number;
  blockId: string;
  hunks: PatchHunk[];
}

/**
 * apply_patch → правки блоков. Патч атомарный: сначала проверяются и применяются все секции, и только если
 * всё сошлось, каждый изменённый блок становится предложением (как от edit_block). Любая ошибка — ничего
 * не предлагается, модель получает все ошибки разом и присылает исправленный патч целиком.
 *
 * База патча — ожидающая правка блока, если она есть, иначе текст блока: так «Переделать» продолжает
 * прошлое предложение. Это же сказано модели в описании инструмента и протоколе. Секции с одним путём
 * применяются по порядку.
 */
export function proposePatch(
  state: CoauthorState,
  cards: CoauthorCardData[],
  input: string,
  editsLeft: number,
): PatchOutcome {
  const parsed = parsePatch(input);
  if (!parsed.ok) return failure(parsed.error);

  const errors: string[] = [];
  const targets = new Map<string, BlockTarget>();
  for (const section of parsed.sections) {
    const ids = parseBlockPath(section.path);
    const card = ids && cards.find((c) => c.id === ids.cardId);
    const block = ids && card?.blocks.find((b) => b.id === ids.blockId);
    if (!ids || !card || !block) {
      errors.push(`${section.path}: no such block — use the \`path\` values from get_cards`);
      continue;
    }
    const key = `${card.id}:${block.id}`;
    const target = targets.get(key) ?? { path: section.path, cardId: card.id, blockId: block.id, hunks: [] };
    target.hunks.push(...section.hunks);
    targets.set(key, target);
  }
  if (errors.length === 0 && targets.size > editsLeft) {
    return failure(
      `this patch changes ${targets.size} blocks, but only ${editsLeft} block edits are left this turn — ` +
        "change fewer blocks, then tell the user what is left",
    );
  }

  const results: Array<{ target: BlockTarget; text: string }> = [];
  for (const target of targets.values()) {
    const block = cards.find((c) => c.id === target.cardId)!.blocks.find((b) => b.id === target.blockId)!;
    const pending = state.proposals.find(
      (p) => p.status === "pending" && p.cardId === target.cardId && p.blockId === target.blockId,
    );
    const base = pending?.content ?? block.content;
    const applied = applyHunks(base, target.hunks);
    if (!applied.ok) {
      errors.push(`${target.path}: ${applied.error}`);
      continue;
    }
    const text = applied.text.trim();
    if (!text) errors.push(`${target.path}: the patch leaves the block empty — blocks cannot be cleared`);
    else if (text === base.trim()) errors.push(`${target.path}: the patch changes nothing`);
    else if (text === block.content) {
      errors.push(`${target.path}: the result equals the current block — just tell the user to reject your pending proposal`);
    } else results.push({ target, text });
  }
  if (errors.length > 0) return failure(errors.join("; "));

  const proposals: CoauthorProposal[] = [];
  for (const { target, text } of results) {
    const outcome = proposeEdit(state, cards, { cardId: target.cardId, blockId: target.blockId, content: text });
    if (outcome.proposal) proposals.push(outcome.proposal);
  }
  return {
    content: JSON.stringify({
      ok: true,
      proposals: proposals.map((p, i) => ({ path: results[i]!.target.path, proposal_id: p.id })),
      status: "waiting for user review",
    }),
    proposals,
  };
}
