import type { ResponsesCustomTool } from "../../llm/responses/types.js";
import type { ToolDefinition } from "../../llm/types.js";
import { ASK_USER_MAX_QUESTIONS, ASK_USER_TOOL_NAME } from "../../cards/generation/ask-user-tool.js";

export const GET_CARDS_TOOL_NAME = "get_cards";
export const EDIT_BLOCK_TOOL_NAME = "edit_block";
export const APPLY_PATCH_TOOL_NAME = "apply_patch";
export { ASK_USER_TOOL_NAME };

export const GET_CARDS_TOOL: ToolDefinition = {
  type: "function",
  function: {
    name: GET_CARDS_TOOL_NAME,
    description: "Returns the current state of every card open in the workshop, including your pending proposals.",
    parameters: { type: "object", properties: {} },
  },
};

export const EDIT_BLOCK_TOOL: ToolDefinition = {
  type: "function",
  function: {
    name: EDIT_BLOCK_TOOL_NAME,
    description:
      "Proposes new content for one block of one card. content replaces the whole block. Use it to fill an " +
      "empty block or to rewrite most of a block; for targeted changes use apply_patch. The user reviews the proposal.",
    parameters: {
      type: "object",
      properties: {
        card_id: { type: "integer", description: "card_id from get_cards" },
        block_id: { type: "string", description: "block_id from get_cards" },
        content: { type: "string", description: "The full new text of the block" },
      },
      required: ["card_id", "block_id", "content"],
    },
  },
};

/**
 * apply_patch — custom-инструмент Responses API (формат патча Codex, модель на нём обучена). Блок — «файл»
 * по пути из get_cards (apply-patch/path.ts). Удобнее edit_block для точечных правок: модель пишет только
 * изменённые строки и может за один вызов поправить несколько блоков и карточек.
 */
export const APPLY_PATCH_TOOL: ResponsesCustomTool = {
  type: "custom",
  name: APPLY_PATCH_TOOL_NAME,
  description:
    "Targeted edits of card blocks. Each block is a file at its `path` from get_cards " +
    "(cards/<card_id>/<block_id>.md). The patch applies to the block's pending_proposal if it has one, " +
    "otherwise to its content. One patch may change several blocks and cards; each changed block becomes a " +
    "proposal for the user to review. Blocks cannot be created, deleted or renamed.",
};

/**
 * ask_user соавтора — то же имя и формат аргументов, что у генерации карточек (разбор общий,
 * parseAskUserArguments), но описание про чат, а не про генерацию одного блока.
 */
export const COAUTHOR_ASK_USER_TOOL: ToolDefinition = {
  type: "function",
  function: {
    name: ASK_USER_TOOL_NAME,
    description:
      "Asks the user clarifying questions before you propose edits, when the request is ambiguous or depends " +
      "on a choice only the user can make. Batch everything into a SINGLE call — up to " +
      `${ASK_USER_MAX_QUESTIONS} questions. Each question can suggest answer options; the user may also answer ` +
      "freely. Don't ask about small details — decide them yourself. Mark the option you recommend.",
    parameters: {
      type: "object",
      properties: {
        questions: {
          type: "array",
          minItems: 1,
          maxItems: ASK_USER_MAX_QUESTIONS,
          items: {
            type: "object",
            properties: {
              question: { type: "string", description: "The question to ask the user" },
              options: { type: "array", items: { type: "string" }, description: "Optional suggested answers" },
              recommended: { type: "string", description: "Optional: the option you recommend, copied exactly" },
            },
            required: ["question"],
          },
        },
      },
      required: ["questions"],
    },
  },
};

export interface EditBlockArguments {
  cardId: number;
  blockId: string;
  content: string;
}

/**
 * Разбирает аргументы edit_block. undefined — аргументы битые: обрезанный лимитом токенов JSON или
 * не те типы. Модель узнаёт об этом ошибкой в результате вызова и может повторить.
 */
export function parseEditBlockArguments(raw: string): EditBlockArguments | undefined {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return undefined;
  }
  if (typeof parsed !== "object" || parsed === null) return undefined;
  const { card_id, block_id, content } = parsed as Record<string, unknown>;
  // Модель иногда шлёт id числом в строке — принимаем, это тот же id.
  const cardId = typeof card_id === "string" && /^\d+$/.test(card_id) ? Number(card_id) : card_id;
  if (typeof cardId !== "number" || !Number.isInteger(cardId)) return undefined;
  if (typeof block_id !== "string" || !block_id) return undefined;
  if (typeof content !== "string") return undefined;
  return { cardId, blockId: block_id, content: content.trim() };
}
