import { Injectable, NotFoundException } from "@nestjs/common";
import logger from "../../logger.js";
import { ChatContextService, MESSAGE_NOT_FOUND } from "../chat-context.service.js";
import { MessagesRepository } from "./messages.repository.js";

/** Сообщения чата вне генерации: переключение ветки, удаление поддерева, кэш переводов. */
@Injectable()
export class MessagesService {
  constructor(
    private readonly messages: MessagesRepository,
    private readonly access: ChatContextService,
  ) {}

  /**
   * Курсор ровно на выбранный узел (без спуска к листу): клик в графе по узлу в середине дерева
   * фиксирует диалог на нём — можно ответвиться отсюда.
   */
  async switchBranch(userId: number, chatId: number, messageId: number): Promise<void> {
    await this.access.requireMessage(userId, chatId, messageId);
    await this.messages.setCursor(chatId, messageId);
  }

  saveTranslation(userId: number, messageId: number, lang: string, text: string): Promise<void> {
    return this.messages.saveTranslation(userId, messageId, lang, text);
  }

  deleteTranslation(messageId: number, lang: string): Promise<void> {
    return this.messages.deleteTranslation(messageId, lang);
  }

  /** Удаляет сообщение со всем поддеревом. */
  async remove(userId: number, chatId: number, messageId: number): Promise<void> {
    await this.access.requireRow(userId, chatId);
    const t0 = Date.now();
    if (!(await this.messages.removeSubtree(userId, chatId, messageId))) throw new NotFoundException(MESSAGE_NOT_FOUND);
    logger.info({ durationMs: Date.now() - t0, userId, chatId, msgId: messageId }, "Message deleted via API");
  }
}
