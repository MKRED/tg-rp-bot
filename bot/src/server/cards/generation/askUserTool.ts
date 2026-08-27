import type { ToolDefinition } from "../../../llm/types.js";

export const ASK_USER_TOOL_NAME = "ask_user";

/** Сколько вопросов модель может задать ЗА ОДИН вызов инструмента (см. описание ниже — модель
 * должна батчить всё нужное в один вызов, а не звать инструмент по одному вопросу за раз). */
export const ASK_USER_MAX_QUESTIONS = 4;

export interface AskUserQuestion {
  question: string;
  /** Опциональные варианты-подсказки — пользователь всё равно может ввести свой текст. */
  options?: string[];
}

/** Схема инструмента для tool_choice: "auto" — модель сама решает, когда нужно уточнение. */
export const ASK_USER_TOOL: ToolDefinition = {
  type: "function",
  function: {
    name: ASK_USER_TOOL_NAME,
    description:
      "Ask the user one or more clarifying questions before generating this block, when you need " +
      "information only the user knows (a preference, a missing detail about the character/setting) " +
      `that isn't in the prompt. Batch everything into a SINGLE call — up to ${ASK_USER_MAX_QUESTIONS} ` +
      "questions at once, not one call per question. Each question can suggest a few answer options, " +
      "but the user may also type a free-form answer instead.",
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
              options: {
                type: "array",
                items: { type: "string" },
                description: "Optional suggested answers to offer the user",
              },
            },
            required: ["question"],
          },
        },
      },
      required: ["questions"],
    },
  },
};

/** Разбирает и валидирует arguments вызова ask_user. undefined — аргументы битые/пустые. */
export function parseAskUserArguments(rawArguments: string): AskUserQuestion[] | undefined {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawArguments);
  } catch {
    return undefined;
  }
  if (typeof parsed !== "object" || parsed === null) return undefined;

  const questionsRaw = (parsed as Record<string, unknown>).questions;
  if (!Array.isArray(questionsRaw) || questionsRaw.length === 0) return undefined;

  const questions: AskUserQuestion[] = [];
  for (const raw of questionsRaw.slice(0, ASK_USER_MAX_QUESTIONS)) {
    if (typeof raw !== "object" || raw === null) return undefined;
    const q = (raw as Record<string, unknown>).question;
    if (typeof q !== "string" || !q.trim()) return undefined;

    const optionsRaw = (raw as Record<string, unknown>).options;
    const options =
      Array.isArray(optionsRaw) && optionsRaw.length > 0 && optionsRaw.every((o) => typeof o === "string")
        ? (optionsRaw as string[])
        : undefined;

    questions.push({ question: q.trim(), options });
  }
  return questions;
}
