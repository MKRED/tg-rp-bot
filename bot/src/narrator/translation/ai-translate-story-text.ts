import type { NarratorTemplate } from "../../db/schema.js";
import { LlmHttpError, MissingApiKeyError } from "../../llm/errors.js";
import type { ChatCompleter } from "../../llm/types.js";
import logger from "../../logger.js";
import {
  aiTranslate,
  joinParagraphs,
  splitParagraphs,
  TRANSLATE_BLOCK_CONCURRENCY,
} from "../../translate/engine/index.js";
import { retry, runWithConcurrency } from "../../utils/index.js";

/**
 * ИИ-перевод текста бита/директивы с учётом translatePerParagraph шаблона: включено — делит текст
 * на абзацы и переводит каждый отдельным запросом параллельно (ограниченная конкурентность, как у
 * батч-эндпоинта /api/translate/text), иначе — один запрос на весь текст (как раньше). В отличие от
 * googleTranslate (GET query string, отсюда MAX_CHARS_PER_CALL в translateChunking.ts), у ИИ-запроса
 * (POST-тело) нет практического лимита длины — дополнительно чанковать текст здесь не нужно, и
 * нельзя: aiTranslate триммит каждый чанк, а без разделителя между чанками абзацы на границе склеятся
 * без пробела. Смысл фичи — thinking модель иначе думает непропорционально долго на большом тексте
 * целиком, а отключать мышление не хотим (см. schema.ts, translatePerParagraph).
 */
export async function aiTranslateStoryText(
  llm: ChatCompleter,
  text: string,
  targetLangName: string,
  userId: string,
  template: NarratorTemplate | null,
  reasoning: { requestReasoning: boolean; reasoningEffort?: string },
): Promise<string> {
  const perParagraph = template?.translatePerParagraph ?? false;

  // При переводе по абзацам один запрос из нескольких параллельных может упасть транзиентно
  // (сеть/5xx) — ретраим каждый отдельно вместо падения всего перевода целиком. llm.complete
  // (llm/client.ts) уже ретраит транзиентные ошибки внутри себя (сеть, 5xx/429, пустой ответ) —
  // этот внешний ретрай добавляет ещё попытку(и) поверх, на случай более долгого сбоя у провайдера.
  // НЕ ретраим постоянные ошибки: отсутствие ключа и LlmHttpError с 4xx (кроме 429) — это те же
  // статусы, на которых внутренний слой уже сознательно сдаётся сразу (см. client.ts), повтор
  // заведомо не поможет и только жжёт время.
  const isPermanentError = (err: unknown): boolean =>
    err instanceof MissingApiKeyError ||
    (err instanceof LlmHttpError && err.status < 500 && err.status !== 429);
  const translateOne = (chunk: string): Promise<string> =>
    retry(
      () =>
        aiTranslate(
          llm,
          template?.translationSystemPrompt ?? "",
          chunk,
          targetLangName,
          userId,
          reasoning.requestReasoning,
          reasoning.reasoningEffort,
        ),
      2,
      1500,
      "aiTranslateStoryText chunk",
      (err) => !isPermanentError(err),
    );

  if (!perParagraph) {
    return translateOne(text);
  }

  const paragraphs = splitParagraphs(text);
  const t0 = Date.now();
  logger.debug({ userId, paragraphCount: paragraphs.length }, "aiTranslateStoryText per-paragraph start");
  // Пустые/whitespace-абзацы (напр. ведущий разрыв) — без сетевого вызова, переносятся как есть.
  const translatedContents = await runWithConcurrency(paragraphs, TRANSLATE_BLOCK_CONCURRENCY, (p) =>
    p.content.trim() === "" ? Promise.resolve(p.content) : translateOne(p.content),
  );
  logger.info(
    { durationMs: Date.now() - t0, userId, paragraphCount: paragraphs.length },
    "aiTranslateStoryText per-paragraph done",
  );
  return joinParagraphs(paragraphs.map((p, i) => ({ ...p, content: translatedContents[i]! })));
}
