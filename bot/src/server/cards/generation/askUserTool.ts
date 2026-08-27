import type { AskUserAnswer, AskUserQuestion } from "../../../db/schema.js";
import type { ToolDefinition } from "../../../llm/types.js";

// Канонические типы — в db/schema.types.ts (там же CardCategory, который их хранит). Реэкспорт
// сохраняет прежнюю точку импорта `from "./askUserTool.js"` для остальных файлов генерации.
export type { AskUserAnswer, AskUserQuestion };

export const ASK_USER_TOOL_NAME = "ask_user";

/** Сколько вопросов модель может задать ЗА ОДИН вызов инструмента (см. описание ниже — модель
 * должна батчить всё нужное в один вызов, а не звать инструмент по одному вопросу за раз). */
export const ASK_USER_MAX_QUESTIONS = 4;

/** Сколько вопрос-ответных пар может накопиться у ОДНОГО блока (askUserAnswers, через все HTTP-
 * раунды ответа в рамках ОДНОЙ попытки генерации, а не за один вызов LLM — см. ASK_USER_MAX_ROUNDS
 * в toolLoop.ts) прежде чем ask_user отключается для его генерации (generateBlock.ts) — иначе
 * пользователя можно было бы затянуть в бесконечную цепочку уточнений одним и тем же блоком.
 * Не лимит на всю жизнь блока: явная «Перегенерировать» сбрасывает askUserAnswers (см.
 * clearCardCategoryAskUserAnswers в db/cards/cards.ts) — новая попытка получает свежий бюджет. */
export const ASK_USER_MAX_ANSWERED_QUESTIONS = 8;

/** Записывается вместо реального ответа при явном отказе пользователя отвечать (см.
 * answerQuestions.ts) — модель видит, что вопрос был задан и отклонён, и не должна переспрашивать
 * то же самое. */
export const ASK_USER_DECLINED_ANSWER = "(user declined to answer)";

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
