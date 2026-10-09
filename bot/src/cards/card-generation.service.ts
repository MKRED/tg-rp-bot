import { BadRequestException, HttpException, Injectable } from "@nestjs/common";
import type { AskUserQuestion } from "@tg-rp-bot/shared";
import {
  answerCardBlockQuestions,
  type AnswerCardBlockQuestionsInput,
} from "../server/cards/generation/answerQuestions.js";
import { generateCardBlock, type GenerateCardBlockResult } from "../server/cards/generation/generateBlock.js";
import { MissingApiKeyError } from "../llm/errors.js";
import logger from "../logger.js";

/** Тело ответа обеих ручек генерации (контракт webapp): блок готов или модель просит уточнений. */
export type GenerationStepBody =
  | { status: "done"; categoryId: string; content: string }
  | { status: "questions"; categoryId: string; questions: AskUserQuestion[] };

/**
 * Поблочная генерация карточки. ВРЕМЕННО — тонкая обёртка над legacy-реализацией в
 * server/cards/generation/ (переносится в Nest отдельным блоком): здесь только перевод её
 * результатов и ошибок в HTTP-контракт Hono-версии.
 */
@Injectable()
export class CardGenerationService {
  /** Следующий незаполненный блок; с categoryId — явная «Перегенерировать» (сброс ответов ask_user). */
  generate(userId: number, cardId: number, categoryId: string | undefined): Promise<GenerationStepBody> {
    return this.run(userId, cardId, "Failed to generate card block", () =>
      generateCardBlock(userId, cardId, categoryId, categoryId !== undefined),
    );
  }

  /** Ответ (или отказ) на вопросы ask_user категории и резюме генерации этого блока. */
  answer(
    userId: number,
    cardId: number,
    categoryId: string,
    input: AnswerCardBlockQuestionsInput,
  ): Promise<GenerationStepBody> {
    return this.run(userId, cardId, "Failed to answer card block questions", () =>
      answerCardBlockQuestions(userId, cardId, categoryId, input),
    );
  }

  private async run(
    userId: number,
    cardId: number,
    failureMessage: string,
    step: () => Promise<GenerateCardBlockResult>,
  ): Promise<GenerationStepBody> {
    let result: GenerateCardBlockResult;
    try {
      result = await step();
    } catch (err) {
      // Нет персонального ключа DeepSeek (BYOK) — 400 с готовой подсказкой, как у остальных генераций.
      // Прочие ошибки логирует ApiExceptionFilter (с userId и путём, где есть id карточки) — здесь
      // не дублируем.
      if (err instanceof MissingApiKeyError) {
        logger.warn({ userId, cardId }, failureMessage);
        throw new BadRequestException({ error: "no_api_key", message: err.message });
      }
      throw err;
    }
    if (!result.ok) throw new HttpException(result.reason, result.status);
    if (result.status === "questions") {
      return { status: "questions", categoryId: result.categoryId, questions: result.questions };
    }
    return { status: "done", categoryId: result.categoryId, content: result.content };
  }
}
