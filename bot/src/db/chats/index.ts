import { DatabaseService } from "../../database/database.service.js";
import { ChatPathRepository } from "../../rp-chat/chat-path.repository.js";
import { ChatsRepository } from "../../rp-chat/chats/chats.repository.js";
import { MessagesRepository } from "../../rp-chat/messages/messages.repository.js";

/**
 * ВРЕМЕННЫЙ мост для legacy стриминговых хендлеров server/chats (send/edit/regenerate/impersonate):
 * те же репозитории, что в Nest (RpChatModule). Удаляется, когда генерация переедет на Nest (@Sse).
 */
const database = new DatabaseService();
const path = new ChatPathRepository(database);
const chats = new ChatsRepository(database, path);
const messages = new MessagesRepository(database, path);

/** Чат + активный путь, только если принадлежит пользователю. */
export const getChat = (userId: number, chatId: number) => chats.findDetail(userId, chatId);

/** Сообщение по id (без проверки владельца — сравнивайте chatId). */
export const getMessage = (userId: number, messageId: number) => messages.findOne(userId, messageId);

export const insertMessage = (...args: Parameters<MessagesRepository["insert"]>) => messages.insert(...args);

/** Курсор — на лист под messageId. */
export const updateActiveMessage = (chatId: number, messageId: number) => messages.moveCursorToLeaf(chatId, messageId);

/** Курсор ровно на узел (или null), без спуска к листу. */
export const setActiveMessage = (chatId: number, messageId: number | null) => messages.setCursor(chatId, messageId);
