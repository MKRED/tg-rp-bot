import { Injectable } from "@nestjs/common";
import type { ChatTranslateTextRequest, TranslateMessageRequest } from "@tg-rp-bot/shared";
import { llmHttpError } from "../../common/llm-http-error.js";
import { MissingApiKeyError } from "../../llm/errors.js";
import { LlmService } from "../../llm/llm.service.js";
import logger from "../../logger.js";
import { NarratorTemplatesRepository } from "../../narrator-templates/narrator-templates.repository.js";
import { englishLangName, googleTranslate, resolveTranslationReasoning } from "../../translate/engine/index.js";
import { StoryMessagesRepository } from "../messages/story-messages.repository.js";
import { StorySettingsRepository } from "../settings/story-settings.repository.js";
import { StoryContextService } from "../story-context.service.js";
import type { StoryRow } from "../stories/stories.repository.js";
import { aiTranslateStoryText } from "./ai-translate-story-text.js";

/**
 * Перевод в истории: сообщения (с кэшем в БД) и эфемерный текст (черновик директивы). ИИ-режим:
 * промпт перевода и рассуждение — из narrator-шаблона истории (шаблон — управляющая поверхность
 * narrator), сэмплинг пресета НЕ переиспользуем: высокие temperature/penalties портят верность перевода.
 */
@Injectable()
export class StoryTranslationService {
  constructor(
    private readonly access: StoryContextService,
    private readonly messages: StoryMessagesRepository,
    private readonly settings: StorySettingsRepository,
    private readonly templates: NarratorTemplatesRepository,
    private readonly llm: LlmService,
  ) {}

  /** Кэш есть и не force — отдаём его; иначе переводим методом из настроек истории и перезаписываем кэш. */
  async translateMessage(userId: string, storyId: number, msgId: number, req: TranslateMessageRequest): Promise<string> {
    const { targetLang, force } = req;
    const { story, msg } = await this.access.requireMessage(userId, storyId, msgId);
    const cached = msg.translations?.[targetLang];
    if (cached && !force) return cached;

    const t0 = Date.now();
    try {
      const { translateMethod } = await this.settings.get(storyId);
      const translation =
        translateMethod === "ai"
          ? await this.aiTranslate(userId, story, msg.content, targetLang)
          : await googleTranslate(msg.content, targetLang);
      await this.messages.saveTranslation(userId, msgId, targetLang, translation);
      logger.info({ durationMs: Date.now() - t0, userId, storyId, msgId, targetLang, translateMethod }, "Story message translated");
      return translation;
    } catch (err) {
      this.logFailure(err, { userId, storyId, msgId }, "Failed to translate story message");
      throw llmHttpError(err);
    }
  }

  async deleteTranslation(userId: string, storyId: number, msgId: number, lang: string): Promise<void> {
    await this.access.requireMessage(userId, storyId, msgId);
    await this.messages.deleteTranslation(msgId, lang);
  }

  /** Эфемерный перевод произвольного текста; без кэша. Без mode — Google Translate. */
  async translateText(userId: string, storyId: number, req: ChatTranslateTextRequest): Promise<string> {
    const { text, targetLang, mode } = req;
    const story = await this.access.requireRow(userId, storyId);
    const t0 = Date.now();
    try {
      const translation =
        mode === "ai" ? await this.aiTranslate(userId, story, text, targetLang) : await googleTranslate(text, targetLang);
      logger.info({ durationMs: Date.now() - t0, userId, storyId, targetLang, mode }, "Story draft translated");
      return translation;
    } catch (err) {
      this.logFailure(err, { userId, storyId, targetLang, mode }, "Failed to translate story draft");
      throw llmHttpError(err);
    }
  }

  private async aiTranslate(userId: string, story: StoryRow, text: string, targetLang: string): Promise<string> {
    const template = story.templateId ? ((await this.templates.findOne(userId, story.templateId)) ?? null) : null;
    const reasoning = resolveTranslationReasoning(template?.translationReasoningEffort);
    return aiTranslateStoryText(this.llm, text, englishLangName(targetLang), userId, template, reasoning);
  }

  /** Нет ключа DeepSeek — штатное состояние (warn), прочее — авария (error). */
  private logFailure(err: unknown, ctx: Record<string, unknown>, msg: string): void {
    if (err instanceof MissingApiKeyError) logger.warn(ctx, `${msg}: не задан ключ DeepSeek`);
    else logger.error({ err, ...ctx }, msg);
  }
}
