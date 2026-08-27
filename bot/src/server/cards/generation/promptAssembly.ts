import type { CardCategory } from "../../../db/cards/index.js";
import type { ChatMessage, ToolCallMessage, ToolResultMessage } from "../../../llm/types.js";
import { ASK_USER_TOOL_NAME } from "./askUserTool.js";

type PromptMessage = ChatMessage | ToolCallMessage | ToolResultMessage;

export interface CardBlockPrompt {
  messages: PromptMessage[];
  targetCategoryId: string;
}

/**
 * Собирает messages[] для генерации следующего блока карточки:
 * - system = systemPrompt карточки как есть (поблочный контракт генерации — формат ответа,
 *   что <example> ниже только образец структуры, задаётся пользователем один раз, не зависит
 *   от конкретного персонажа);
 * - первый user = основной промпт со вставленным <example>-блоком (title+description enabled-
 *   категорий); для самой первой генерации к нему же в конец добавляется запрос на первый блок —
 *   единый первый ход диалога, отдельного user-сообщения не нужно;
 * - далее уже сгенерированные enabled-категории — парами assistant (сохранённый content) / user
 *   (короткий запрос на следующий блок), история делает предыдущие блоки видимыми модели;
 * - последний user (если это не первая генерация) — запрос на целевой блок.
 * Отключённые (enabled: false) категории не попадают ни в <example>, ни в историю — как будто их
 * не существует.
 *
 * targetCategoryId — явная цель (перегенерация уже заполненного блока «как если бы шли по
 * очереди»): контекстом служат блоки СТРОГО ДО него по позиции (их текущий content), сам блок
 * и всё, что после — не читаются, будто ещё не существуют. Без параметра — как раньше, целью
 * становится первая enabled-категория с пустым content.
 *
 * askUserAnswers каждой категории (см. schema.types.ts) реплеится в её историю КАК НАСТОЯЩИЙ
 * tool_call/tool_result (см. appendAskUserExchange) — синтетический assistant-ход с tool_calls
 * (ask_user, вопросы как аргументы) сразу за user-сообщением, которым блок был запрошен, и tool-
 * сообщение с ответами сразу после. Модель должна видеть, что это результат ЕЁ ЖЕ вызова
 * инструмента, а не текст, будто пользователь сам где-то это сказал (сервер накопил только пары
 * вопрос-ответ — см. applyCardCategoryAnswers, — не исходный tool_call модели, поэтому и id
 * tool_call, и сама обёртка вызова здесь синтетические, восстановленные заново).
 *
 * undefined — генерировать нечего: явная цель не найдена среди enabled-категорий, целевая позиция
 * не первая, но что-то ПЕРЕД ней ещё не заполнено (иначе в историю ушло бы пустое assistant-
 * сообщение — рассинхрон с реальной последовательностью), либо (без targetCategoryId) все
 * enabled-категории уже имеют content, либо enabled-категорий нет вовсе.
 */
export function assembleCardBlockPrompt(
  systemPrompt: string,
  prompt: string,
  categories: CardCategory[],
  targetCategoryId?: string,
): CardBlockPrompt | undefined {
  const enabled = categories.filter((c) => c.enabled);
  const targetIndex =
    targetCategoryId !== undefined
      ? enabled.findIndex((c) => c.id === targetCategoryId)
      : enabled.findIndex((c) => c.content.trim() === "");
  if (targetIndex === -1) return undefined;
  if (enabled.slice(0, targetIndex).some((c) => c.content.trim() === "")) return undefined;
  const target = enabled[targetIndex]!;

  const messages: PromptMessage[] = [{ role: "system", content: systemPrompt }];

  const mainUserContent = insertExampleBlock(prompt, buildExampleBlock(enabled));
  messages.push({
    role: "user",
    content: targetIndex === 0 ? `${mainUserContent}\n\n${blockRequest(target.title)}` : mainUserContent,
  });
  appendAskUserExchange(messages, targetIndex === 0 ? target : enabled[0]!);

  if (targetIndex > 0) {
    messages.push({ role: "assistant", content: enabled[0]!.content });
    for (const cat of enabled.slice(1, targetIndex)) {
      messages.push({ role: "user", content: blockRequest(cat.title) });
      appendAskUserExchange(messages, cat);
      messages.push({ role: "assistant", content: cat.content });
    }
    messages.push({ role: "user", content: blockRequest(target.title) });
    appendAskUserExchange(messages, target);
  }

  return { messages, targetCategoryId: target.id };
}

/** Короткий запрос на генерацию конкретного блока — на английском, формат ответа задаёт system. */
function blockRequest(title: string): string {
  return `Generate the "${title}" block.`;
}

/**
 * Дописывает в историю синтетическую пару assistant tool_calls(ask_user) + tool-result — реплей
 * уже собранных askUserAnswers категории как настоящего вызова инструмента (см. докблок
 * assembleCardBlockPrompt), а не текста в user-сообщении. id tool_call — стабильный синтетический
 * (свой на category.id), а не реальный id исходного вызова модели: сервер его не хранит (см.
 * applyCardCategoryAnswers), но провайдеру важно только совпадение id между tool_calls и
 * tool_call_id, не его происхождение. Аргументы вызова восстанавливаются из вопросов (без options —
 * они были нужны только для UI подсказок, для контекста генерации достаточно текста вопроса).
 * Пусто — если ответов не было вовсе.
 */
function appendAskUserExchange(messages: PromptMessage[], category: CardCategory): void {
  const answers = category.askUserAnswers;
  if (!answers || answers.length === 0) return;
  const toolCallId = `ask_user_${category.id}`;
  messages.push({
    role: "assistant",
    content: null,
    // DeepSeek thinking-режим требует reasoning_content на ЛЮБОМ assistant-сообщении с tool_calls в
    // истории, даже синтетическом (без него — 400 "reasoning_content in the thinking mode must be
    // passed back", подтверждено ручным запросом к DeepSeek) — реальных «мыслей» модели за этим
    // вызовом сервер не хранит (см. докблок assembleCardBlockPrompt), поэтому здесь заглушка.
    reasoning_content: "Deciding to ask the user a clarifying question before generating this block.",
    tool_calls: [
      {
        id: toolCallId,
        type: "function",
        function: {
          name: ASK_USER_TOOL_NAME,
          arguments: JSON.stringify({ questions: answers.map((a) => ({ question: a.question })) }),
        },
      },
    ],
  });
  messages.push({
    role: "tool",
    tool_call_id: toolCallId,
    content: JSON.stringify({
      answers: answers.map((a) => ({ question: a.question, answer: a.answer })),
      note: "These have already been answered — don't call ask_user again for the same information.",
    }),
  });
}

/** <example>-блок из title+description enabled-категорий — образец формата для ИИ. */
function buildExampleBlock(enabled: CardCategory[]): string {
  const body = enabled.map((c) => `# ${c.title}\n${c.description}`).join("\n\n");
  return `<example>\n${body}\n</example>`;
}

/**
 * Вставляет <example>-блок на место плейсхолдера {{example}} (регистронезависимо); если
 * плейсхолдера в промпте нет — дописывает блок в конец. Регекс без флага g (.test()) не хранит
 * lastIndex между вызовами; для .replace() глобальный регекс создаётся отдельным литералом —
 * функция не опирается ни на какое module-level состояние и идемпотентна между вызовами.
 */
function insertExampleBlock(prompt: string, exampleBlock: string): string {
  if (!/\{\{example\}\}/i.test(prompt)) return `${prompt}\n\n${exampleBlock}`;
  return prompt.replace(/\{\{example\}\}/gi, exampleBlock);
}
