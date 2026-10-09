import { Injectable, NotFoundException } from "@nestjs/common";
import type { ChatDetail, ChatListItem, CreateChatRequest, TreeNode } from "@tg-rp-bot/shared";
import { CharactersRepository } from "../../characters/characters.repository.js";
import type { Chat } from "../../db/schema.js";
import logger from "../../logger.js";
import { PersonasRepository } from "../../personas/personas.repository.js";
import { PresetsRepository } from "../../presets/presets.repository.js";
import { RpTemplatesRepository } from "../../rp-templates/rp-templates.repository.js";
import { CHAT_NOT_FOUND, ChatContextService } from "../chat-context.service.js";
import { ChatsRepository } from "./chats.repository.js";

/** Чаты пользователя: список, создание из своих сущностей, переименование, удаление, граф веток. */
@Injectable()
export class ChatsService {
  constructor(
    private readonly chats: ChatsRepository,
    private readonly access: ChatContextService,
    private readonly characters: CharactersRepository,
    private readonly personas: PersonasRepository,
    private readonly templates: RpTemplatesRepository,
    private readonly presets: PresetsRepository,
  ) {}

  list(userId: number, page: number, pageSize: number): Promise<{ items: ChatListItem[]; total: number }> {
    return this.chats.list(userId, page, pageSize);
  }

  /**
   * Все сущности должны принадлежать пользователю (репозитории user-scoped → undefined для чужих);
   * проверяем по порядку, 404 — на первой не найденной.
   */
  async create(userId: number, input: CreateChatRequest): Promise<Chat> {
    const { characterId, personaId, templateId, presetId, firstMessageIndex } = input;
    const character = await this.characters.findOne(userId, characterId);
    if (!character) throw new NotFoundException("Character not found");
    if (!(await this.personas.findOne(userId, personaId))) throw new NotFoundException("Persona not found");
    if (!(await this.templates.findOne(userId, templateId))) throw new NotFoundException("Template not found");
    if (!(await this.presets.findOne(userId, presetId))) throw new NotFoundException("Preset not found");

    // Нет приветствий или индекс вне диапазона → null: чат стартует пустым.
    const firstMessage = character.firstMessages[firstMessageIndex] ?? null;
    const t0 = Date.now();
    const chat = await this.chats.create(userId, { characterId, personaId, templateId, presetId }, firstMessage);
    logger.info({ durationMs: Date.now() - t0, userId, chatId: chat.id }, "Chat created via API");
    return chat;
  }

  async get(userId: number, chatId: number): Promise<ChatDetail> {
    const chat = await this.chats.findDetail(userId, chatId);
    if (!chat) throw new NotFoundException(CHAT_NOT_FOUND);
    return chat;
  }

  async rename(userId: number, chatId: number, title: string): Promise<string | null> {
    const result = await this.chats.rename(userId, chatId, title);
    if (!result) throw new NotFoundException(CHAT_NOT_FOUND);
    return result.title;
  }

  async remove(userId: number, chatId: number): Promise<void> {
    if (!(await this.chats.remove(userId, chatId))) throw new NotFoundException(CHAT_NOT_FOUND);
  }

  async tree(userId: number, chatId: number): Promise<TreeNode[]> {
    const chat = await this.access.requireRow(userId, chatId);
    return this.chats.tree(userId, chat);
  }
}
