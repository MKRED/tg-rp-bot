import type { CoauthorStep } from "@tg-rp-bot/shared";
import { WEB_SEARCH_TOOL_NAME } from "../../web-search/web-search-tool.js";
import { parseBlockPath, parsePatch, streamedPatchPaths } from "./apply-patch/index.js";
import { APPLY_PATCH_TOOL_NAME, EDIT_BLOCK_TOOL_NAME, GET_CARDS_TOOL_NAME } from "./tools.js";

// Аргументы читаем регулярками, а не JSON.parse: шаг нужен, пока аргументы ещё стримятся и JSON неполон
// (весь текст блока идёт следом, это десятки секунд). Кавычки внутри content экранированы, поэтому
// текст блока за имя поля не примется. Число — только с разделителем после него: без него «12» могло
// бы оказаться началом «123».
const CARD_ID = /"card_id"\s*:\s*"?(\d+)"?\s*[,}]/;
const BLOCK_ID = /"block_id"\s*:\s*("(?:[^"\\]|\\.)*")/;
const QUERY = /"query"\s*:\s*("(?:[^"\\]|\\.)*")/;

/** Значение JSON-строки, вырезанной регуляркой; битая строка — undefined. */
function jsonString(match: RegExpExecArray | null): string | undefined {
  if (!match) return undefined;
  try {
    return JSON.parse(match[1]!) as string;
  } catch {
    return undefined;
  }
}

function hasError(result: string): boolean {
  try {
    const parsed: unknown = JSON.parse(result);
    return typeof parsed === "object" && parsed !== null && "error" in parsed;
  } catch {
    return false;
  }
}

/**
 * Шаг хода для экрана по вызову инструмента. Аргументы могут быть неполными: undefined — показывать
 * пока нечего (или это ask_user: его вопросы и так видны в ленте). result — что инструмент вернул
 * модели; без него шаг ещё идёт.
 */
export function callStep(call: { id: string; name: string; arguments: string }, result?: string): CoauthorStep | undefined {
  const status = result === undefined ? "running" : hasError(result) ? "failed" : "done";
  if (call.name === GET_CARDS_TOOL_NAME) return { id: call.id, status, kind: "cards" };
  if (call.name === WEB_SEARCH_TOOL_NAME) {
    const query = jsonString(QUERY.exec(call.arguments));
    return query === undefined ? undefined : { id: call.id, status, kind: "search", query };
  }
  if (call.name === EDIT_BLOCK_TOOL_NAME) {
    const cardId = CARD_ID.exec(call.arguments)?.[1];
    const blockId = jsonString(BLOCK_ID.exec(call.arguments));
    return cardId === undefined || blockId === undefined ? undefined : { id: call.id, status, kind: "edit", cardId: Number(cardId), blockId };
  }
  return undefined;
}

/**
 * Шаги одного вызова. У apply_patch — по шагу на каждый блок патча (id `<вызов>:<карточка>:<блок>`):
 * пока патч стримится, блоки появляются по мере законченных строк `*** Update File:`; итог — по
 * разобранному патчу. Остальные инструменты — не больше одного шага (callStep).
 */
export function callSteps(call: { id: string; name: string; arguments: string }, result?: string): CoauthorStep[] {
  if (call.name !== APPLY_PATCH_TOOL_NAME) {
    const step = callStep(call, result);
    return step ? [step] : [];
  }
  const status = result === undefined ? "running" : hasError(result) ? "failed" : "done";
  const parsed = result === undefined ? undefined : parsePatch(call.arguments);
  // Пока патч пишется, последняя строка может быть недописана — её не берём; у законченного (даже
  // битого) патча последняя строка полная.
  const paths = parsed?.ok
    ? parsed.sections.map((s) => s.path)
    : streamedPatchPaths(result === undefined ? call.arguments : `${call.arguments}\n`);
  const steps: CoauthorStep[] = [];
  for (const path of paths) {
    const ids = parseBlockPath(path);
    if (!ids) continue;
    const id = `${call.id}:${ids.cardId}:${ids.blockId}`;
    if (!steps.some((s) => s.id === id)) steps.push({ id, status, kind: "edit", cardId: ids.cardId, blockId: ids.blockId });
  }
  return steps;
}
