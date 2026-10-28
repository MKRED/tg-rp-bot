import type { CardCategory } from "@tg-rp-bot/shared";
import type { ChatMessage, MultimodalUserMessage, ToolCallMessage, ToolResultMessage } from "../../llm/types.js";
import { buildToolContextMessages } from "./tool-context.js";

type PromptMessage = ChatMessage | MultimodalUserMessage | ToolCallMessage | ToolResultMessage;

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
 * referenceImages — картинки-референсы карточки: прикрепляются к ПЕРВОМУ user-сообщению (основной
 * промпт) составным content[] с короткой пометкой в тексте. Только к первому: оно реплеится в каждом
 * запросе, так что модель видит картинки при генерации любого блока, а дублировать их в каждом
 * запросе блока — лишние ~1000 токенов за картинку.
 *
 * Контекст инструментов каждой категории (сохранённые веб-поиски и ответы ask_user) реплеится в её
 * историю КАК НАСТОЯЩИЕ tool_call/tool_result сразу за user-сообщением, которым блок был запрошен
 * (см. buildToolContextMessages в tool-context.ts) — и для целевого блока, и для всех блоков до него.
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
  referenceImages: string[] = [],
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

  const withExample = insertExampleBlock(prompt, buildExampleBlock(enabled));
  // Пометка про референсы — до запроса блока: запрос остаётся последней строкой хода, как без картинок.
  const mainUserContent = referenceImages.length > 0 ? `${withExample}\n\n${REFERENCE_IMAGES_NOTE}` : withExample;
  const mainUserText = targetIndex === 0 ? `${mainUserContent}\n\n${blockRequest(target.title)}` : mainUserContent;
  messages.push(buildMainUserMessage(mainUserText, referenceImages));
  messages.push(...buildToolContextMessages(targetIndex === 0 ? target : enabled[0]!));

  if (targetIndex > 0) {
    messages.push({ role: "assistant", content: enabled[0]!.content });
    for (const cat of enabled.slice(1, targetIndex)) {
      messages.push({ role: "user", content: blockRequest(cat.title) });
      messages.push(...buildToolContextMessages(cat));
      messages.push({ role: "assistant", content: cat.content });
    }
    messages.push({ role: "user", content: blockRequest(target.title) });
    messages.push(...buildToolContextMessages(target));
  }

  return { messages, targetCategoryId: target.id };
}

/**
 * Первое user-сообщение: без картинок — обычная строка (как было), с картинками — content[] из текста
 * и самих картинок (image_url с data URL, формат DeepSeek).
 */
function buildMainUserMessage(text: string, referenceImages: string[]): ChatMessage | MultimodalUserMessage {
  if (referenceImages.length === 0) return { role: "user", content: text };
  return {
    role: "user",
    content: [
      { type: "text", text },
      ...referenceImages.map((url) => ({ type: "image_url" as const, image_url: { url } })),
    ],
  };
}

/** Пометка к картинкам — на английском, как и остальные служебные части промпта. */
const REFERENCE_IMAGES_NOTE =
  "The attached images are visual references for this character. Base the character's appearance " +
  "(body, face, hair, eyes, outfit, accessories, overall style) on them.";

/** Короткий запрос на генерацию конкретного блока — на английском, формат ответа задаёт system. */
function blockRequest(title: string): string {
  return `Generate the "${title}" block.`;
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
