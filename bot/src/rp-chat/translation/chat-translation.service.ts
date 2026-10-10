import { Injectable } from "@nestjs/common";
import type { ChatTranslateTextRequest, TranslateMessageRequest } from "@tg-rp-bot/shared";
import { llmHttpError } from "../../common/llm-http-error.js";
import { MissingApiKeyError } from "../../llm/errors.js";
import { LlmService } from "../../llm/llm.service.js";
import logger from "../../logger.js";
import { PresetsRepository } from "../../presets/presets.repository.js";
import { RpTemplatesRepository } from "../../rp-templates/rp-templates.repository.js";
import { aiTranslate, englishLangName, googleTranslate } from "../../translate/engine/index.js";
import { ChatContextService } from "../chat-context.service.js";
import type { ChatRow } from "../chats/chats.repository.js";
import { MessagesService } from "../messages/messages.service.js";
import { ChatSettingsRepository } from "../settings/chat-settings.repository.js";

/**
 * Перевод в RP-чате: сообщения (с кэшем в БД) и эфемерный текст (черновик, варианты impersonate).
 * ИИ-режим: промпт перевода — из RP-шаблона чата, эффорт рассуждения — из пресета. Сэмплинг пресета
 * НЕ переиспользуем: его maxTokens обрезал бы длинный перевод, а temperature/penalties под RP портят
 * верность перевода.
 */
@Injectable()
export class ChatTranslationService {
  constructor(
    private readonly access: ChatContextService,
    private readonly messages: MessagesService,
    private readonly settings: ChatSettingsRepository,
    private readonly templates: RpTemplatesRepository,
    private readonly presets: PresetsRepository,
    private readonly llm: LlmService,
  ) {}

  /**
   * Перевод сообщения. Кэш есть и не force — отдаём его; иначе переводим методом из настроек чата
   * (google/ai) и перезаписываем кэш для языка.
   */
  async translateMessage(userId: number, chatId: number, msgId: number, req: TranslateMessageRequest): Promise<string> {
    const { targetLang, force } = req;
    const { chat, msg } = await this.access.requireMessage(userId, chatId, msgId);
    const cached = msg.translations?.[targetLang];
    if (cached && !force) return cached;

    try {
      const { translateMethod } = await this.settings.get(chatId);
      const translation =
        translateMethod === "ai"
          ? await this.aiTranslate(userId, chat, msg.content, targetLang)
          : await googleTranslate(msg.content, targetLang);
      await this.messages.saveTranslation(userId, msgId, targetLang, translation);
      return translation;
    } catch (err) {
      this.logFailure(err, { userId, chatId, msgId }, "Failed to translate message");
      throw llmHttpError(err);
    }
  }

  async deleteTranslation(userId: number, chatId: number, msgId: number, lang: string): Promise<void> {
    await this.access.requireMessage(userId, chatId, msgId);
    await this.messages.deleteTranslation(msgId, lang);
  }

  /** Эфемерный перевод произвольного текста; без кэша. */
  async translateText(userId: number, chatId: number, req: ChatTranslateTextRequest): Promise<string> {
    const { text, targetLang, mode } = req;
    const chat = await this.access.requireRow(userId, chatId);
    try {
      return mode === "ai" ? await this.aiTranslate(userId, chat, text, targetLang) : await googleTranslate(text, targetLang);
    } catch (err) {
      this.logFailure(err, { userId, chatId }, "Failed to translate draft text");
      throw llmHttpError(err);
    }
  }

  private async aiTranslate(userId: number, chat: ChatRow, text: string, targetLang: string): Promise<string> {
    const [template, preset] = await Promise.all([
      chat.templateId ? this.templates.findOne(userId, chat.templateId) : undefined,
      chat.presetId ? this.presets.findOne(userId, chat.presetId) : undefined,
    ]);
    return aiTranslate(
      this.llm,
      template?.translationSystemPrompt ?? "",
      text,
      englishLangName(targetLang),
      userId,
      true,
      preset?.reasoningEffort,
    );
  }

  /** Нет ключа DeepSeek — штатное состояние (warn), прочее — авария (error). */
  private logFailure(err: unknown, ctx: Record<string, unknown>, msg: string): void {
    if (err instanceof MissingApiKeyError) logger.warn(ctx, `${msg}: не задан ключ DeepSeek`);
    else logger.error({ err, ...ctx }, msg);
  }
}
