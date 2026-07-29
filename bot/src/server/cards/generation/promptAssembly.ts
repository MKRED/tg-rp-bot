import type { CardCategory } from "../../../db/cards/index.js";
import type { ChatMessage } from "../../../llm/types.js";

export interface CardBlockPrompt {
  messages: ChatMessage[];
  targetCategoryId: string;
}

/**
 * Собирает messages[] для генерации следующего блока карточки: system = основной промпт со
 * вставленным <example>-блоком структуры (title+description enabled-категорий), история —
 * уже сгенерированные enabled-категории как пары user/assistant (модель «помнит» свои прошлые
 * блоки), последний user-запрос — просьба сгенерировать конкретно следующий блок. Отключённые
 * (enabled: false) категории не попадают ни в <example>, ни в историю — как будто их не существует.
 *
 * undefined — генерировать больше нечего: все enabled-категории уже имеют content, либо
 * enabled-категорий нет вовсе.
 */
export function assembleCardBlockPrompt(
  prompt: string,
  categories: CardCategory[],
): CardBlockPrompt | undefined {
  const enabled = categories.filter((c) => c.enabled);
  const targetIndex = enabled.findIndex((c) => c.content.trim() === "");
  if (targetIndex === -1) return undefined;
  const target = enabled[targetIndex]!;

  const messages: ChatMessage[] = [
    { role: "system", content: insertExampleBlock(prompt, buildExampleBlock(enabled)) },
  ];

  for (const cat of enabled.slice(0, targetIndex)) {
    messages.push({ role: "user", content: `Сгенерируй блок "${cat.title}".` });
    messages.push({ role: "assistant", content: cat.content });
  }

  messages.push({
    role: "user",
    content: `Сгенерируй блок "${target.title}", используя описание/пример выше. Ответь только текстом блока — без заголовка, markdown-обрамления и пояснений.`,
  });

  return { messages, targetCategoryId: target.id };
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
