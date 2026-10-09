import { BadRequestException, HttpException, Injectable } from "@nestjs/common";
import type {
  AnswerCardQuestionsInput,
  AskUserAnswer,
  CardGenerationError,
  CardGenerationStep,
} from "@tg-rp-bot/shared";
import { getDecryptedTavilyKey, getTavilyMaxSearchRounds } from "../../db/userTavilySettings.js";
import { MissingApiKeyError } from "../../llm/errors.js";
import logger from "../../logger.js";
import { PresetsRepository } from "../../presets/presets.repository.js";
import { presetToCompletionOptions } from "../../server/prompt/promptBuilder/index.js";
import { tryLockCard, unlockCard } from "../card-lock.js";
import { CardsRepository } from "../cards.repository.js";
import { ASK_USER_DECLINED_ANSWER, ASK_USER_MAX_ANSWERED_QUESTIONS } from "./ask-user-tool.js";
import { assembleCardBlockPrompt } from "./prompt-assembly.js";
import { runCardGenerationToolLoop } from "./tool-loop.js";

/** Отказ генерации: код причины в `{ error }` (контракт webapp) с HTTP-статусом. */
function refuse(status: 400 | 404 | 409, reason: CardGenerationError): HttpException {
  return new HttpException(reason, status);
}

/**
 * Поблочная генерация карточки (см. assembleCardBlockPrompt) с function calling (web_search +
 * ask_user, tool-loop.ts). Сэмплинг/reasoning — из пресета карточки (presetToCompletionOptions, как
 * у RP-чата/narrator): пользователь явно предпочёл reasoning форсированному JSON-режиму, поэтому
 * здесь нет ни response_format, ни отключения thinking — обычная генерация текста.
 */
@Injectable()
export class CardGenerationService {
  constructor(
    private readonly cards: CardsRepository,
    private readonly presets: PresetsRepository,
  ) {}

  /**
   * Генерирует блок и сохраняет результат в его content. Без categoryId — следующий незаполненный
   * enabled-блок («Сгенерировать»); с categoryId — явно указанный блок, перегенерация «как если бы
   * шли по очереди».
   *
   * resetAskUserAnswers — true только у явной «Перегенерировать» (ручка generate с categoryId):
   * сбрасывает askUserAnswers целевой категории, чтобы ответы для заменяемого варианта блока не
   * реплеились в промпт и не занимали ASK_USER_MAX_ANSWERED_QUESTIONS вечно. false — резюме паузы
   * ask_user внутри одной попытки (answer), где ответы, наоборот, накапливаются.
   *
   * Держит cardLock на всё время вызова — не только против повторного клика, но и против
   * параллельного PUT (оба пути делают read-modify-write полной строки, см. card-lock.ts). На паузе
   * ask_user лок тоже снимается: вопросы уже персистентны на категории, ждать ответа нечем.
   */
  async generate(
    userId: number,
    cardId: number,
    categoryId?: string,
    resetAskUserAnswers = false,
  ): Promise<CardGenerationStep> {
    if (!tryLockCard(cardId)) throw refuse(409, "busy");
    const t0 = Date.now();
    try {
      let card = await this.cards.findOne(userId, cardId);
      if (!card) throw refuse(404, "not_found");

      const hasAnswers = card.categories.some((c) => c.id === categoryId && c.askUserAnswers?.length);
      if (resetAskUserAnswers && categoryId && hasAnswers) {
        card = await this.cards.clearCategoryAskUserAnswers(userId, cardId, categoryId);
        if (!card) throw refuse(404, "not_found");
      }

      if (card.presetId == null) throw refuse(400, "preset_required");
      const preset = await this.presets.findOne(userId, card.presetId);
      if (!preset) throw refuse(400, "preset_required");

      const assembled = assembleCardBlockPrompt(card.systemPrompt, card.prompt, card.categories, categoryId);
      if (!assembled) {
        // Явный categoryId без валидной цели — локальное состояние клиента разошлось с сохранённым
        // (категория удалена/выключена/что-то перед ней не заполнено в другой сессии): это не тот же
        // случай, что «генерировать больше нечего» у обычной кнопки.
        throw categoryId ? refuse(400, "target_not_found") : refuse(409, "nothing_to_generate");
      }

      // Ключ мог быть удалён в настройках, а тумблер на карточке остался включённым — генерируем
      // без поиска, а не роняем генерацию блока (но не молчим).
      const tavilyApiKey = card.useWebSearch ? await getDecryptedTavilyKey(userId) : null;
      if (card.useWebSearch && !tavilyApiKey) {
        logger.warn({ userId, cardId }, "Card useWebSearch включён, но ключ Tavily не задан — генерируем без поиска");
      }

      // Гейт на накопленный ask_user-бюджет ЭТОГО блока — сквозь все HTTP-раунды ответа, а не только
      // текущий вызов LLM (см. ASK_USER_MAX_ANSWERED_QUESTIONS).
      const target = card.categories.find((c) => c.id === assembled.targetCategoryId);
      const askUserEnabled = card.useAskUser && (target?.askUserAnswers?.length ?? 0) < ASK_USER_MAX_ANSWERED_QUESTIONS;

      const outcome = await runCardGenerationToolLoop({
        baseOptions: { userId, debugLabel: "cards", ...presetToCompletionOptions(preset) },
        history: assembled.messages,
        tavilyApiKey,
        maxSearchRounds: await getTavilyMaxSearchRounds(userId),
        askUserEnabled,
      });

      if (!outcome.done) {
        const { questions } = outcome;
        const targetId = assembled.targetCategoryId;
        const saved = await this.cards.setCategoryPendingQuestions(userId, cardId, targetId, questions);
        if (!saved) throw refuse(404, "not_found");
        return { status: "questions", categoryId: targetId, questions };
      }

      const content = outcome.content.trim();
      const saved = await this.cards.setCategoryContent(userId, cardId, assembled.targetCategoryId, content);
      if (!saved) throw refuse(404, "not_found");
      logger.info(
        { durationMs: Date.now() - t0, userId, cardId, categoryId: assembled.targetCategoryId },
        "Card block generated",
      );
      // Только categoryId+content, не вся карточка: клиент мержит точечно, не затирая категории,
      // которые пользователь мог параллельно править локально (ещё не сохранены).
      return { status: "done", categoryId: assembled.targetCategoryId, content };
    } catch (err) {
      throw toHttpError(err, userId, cardId);
    } finally {
      unlockCard(cardId);
    }
  }

  /**
   * Записывает ответы (или отказ) на вопросы ask_user категории и генерирует этот блок заново —
   * уже с ответами в контексте (assembleCardBlockPrompt реплеит их как синтетический
   * tool_call/tool_result). Это НЕ резюме того же LLM-разговора: исходный tool_call сервер не
   * хранит, только пары вопрос-ответ на категории — поэтому у ответа нет ограничения по времени.
   *
   * cardLock держится ТОЛЬКО вокруг чтения+записи ответов (иначе конкурентный PUT в это окно тихо
   * потерял бы одну из записей) и снимается ДО generate: лок не реентерабелен, а generate берёт его
   * сам — удержание здесь давало бы гарантированный "busy" на каждый ответ.
   */
  async answer(
    userId: number,
    cardId: number,
    categoryId: string,
    input: AnswerCardQuestionsInput,
  ): Promise<CardGenerationStep> {
    const t0 = Date.now();
    if (!tryLockCard(cardId)) throw refuse(409, "busy");
    let answeredCount: number;
    try {
      const card = await this.cards.findOne(userId, cardId);
      if (!card) throw refuse(404, "not_found");

      const pending = card.categories.find((c) => c.id === categoryId)?.pendingQuestions;
      if (!pending || pending.length === 0) {
        // Вопрос уже неактуален — ответили в другой вкладке, категорию удалили/выключили в форме,
        // либо запрос повторный. Ничего не трогаем, клиент предложит сгенерировать блок заново.
        logger.warn({ userId, cardId, categoryId }, "Ответ на ask_user: вопрос уже неактуален");
        throw refuse(404, "no_pending_question");
      }
      if (!input.skipped && input.answers.length !== pending.length) {
        logger.warn(
          { userId, cardId, categoryId, expected: pending.length, got: input.answers.length },
          "Ответ на ask_user: число ответов не совпадает с числом вопросов",
        );
        throw refuse(400, "answers_mismatch");
      }

      const answers: AskUserAnswer[] = pending.map((q, i) => ({
        question: q.question,
        answer: input.skipped ? ASK_USER_DECLINED_ANSWER : input.answers[i]!,
        options: q.options,
      }));
      answeredCount = answers.length;
      if (!(await this.cards.applyCategoryAnswers(userId, cardId, categoryId, answers))) {
        throw refuse(404, "not_found");
      }
    } finally {
      unlockCard(cardId);
    }

    const result = await this.generate(userId, cardId, categoryId);
    logger.info(
      {
        userId, cardId, categoryId, answeredCount, skipped: input.skipped, status: result.status,
        durationMs: Date.now() - t0,
      },
      "Ask_user: ответы сохранены, генерация блока резюмирована",
    );
    return result;
  }
}

/**
 * Нет персонального ключа DeepSeek (BYOK) — 400 с готовой подсказкой, как у остальных генераций.
 * Остальное — как есть: HttpException-отказы уходят клиенту, прочие ошибки логирует ApiExceptionFilter.
 */
function toHttpError(err: unknown, userId: number, cardId: number): unknown {
  if (!(err instanceof MissingApiKeyError)) return err;
  logger.warn({ userId, cardId }, "Card generation: не задан ключ DeepSeek");
  return new BadRequestException({ error: "no_api_key", message: err.message });
}
