import { Injectable, NotFoundException } from "@nestjs/common";
import type { ChatDetail } from "@tg-rp-bot/shared";
import { CharactersRepository } from "../characters/characters.repository.js";
import type { Character, GenerationPreset, Message, Persona, RpTemplate } from "../db/schema.js";
import { PersonasRepository } from "../personas/personas.repository.js";
import { PresetsRepository } from "../presets/presets.repository.js";
import { RpTemplatesRepository } from "../rp-templates/rp-templates.repository.js";
import { type ChatRow, ChatsRepository } from "./chats/chats.repository.js";
import { MessagesRepository } from "./messages/messages.repository.js";

/**
 * Чат + связанные сущности. template — источник промптов, preset — только сэмплинг (см. schema.ts);
 * persona/template/preset — NOT NULL в схеме, но отсутствие любого не должно валить генерацию.
 */
export type ChatContext = {
  chat: ChatDetail;
  character: Character;
  persona: Persona | null;
  template: RpTemplate | null;
  preset: GenerationPreset | null;
};

export const CHAT_NOT_FOUND = "Chat not found";
export const MESSAGE_NOT_FOUND = "Message not found";

/**
 * Доступ к чату с проверкой владельца: лёгкая строка (принадлежность, курсор), сообщение этого чата
 * или полный контекст для генерации.
 */
@Injectable()
export class ChatContextService {
  constructor(
    private readonly chats: ChatsRepository,
    private readonly messages: MessagesRepository,
    private readonly characters: CharactersRepository,
    private readonly personas: PersonasRepository,
    private readonly templates: RpTemplatesRepository,
    private readonly presets: PresetsRepository,
  ) {}

  /** Строка чата пользователя без сообщений; чужой/несуществующий — 404 Chat not found. */
  async requireRow(userId: string, chatId: number): Promise<ChatRow> {
    const row = await this.chats.findRow(userId, chatId);
    if (!row) throw new NotFoundException(CHAT_NOT_FOUND);
    return row;
  }

  /**
   * Сообщение этого чата пользователя. Сначала владелец чата (404 Chat not found), потом сообщение
   * (404 Message not found): сам по себе id сообщения не проверяет владельца.
   */
  async requireMessage(userId: string, chatId: number, messageId: number): Promise<{ chat: ChatRow; msg: Message }> {
    const chat = await this.requireRow(userId, chatId);
    const msg = await this.messages.findOne(userId, chatId, messageId);
    if (!msg) throw new NotFoundException(MESSAGE_NOT_FOUND);
    return { chat, msg };
  }

  /** Чат с активным путём + персонаж/персона/шаблон/пресет. Нет чата или персонажа — 404 Chat not found. */
  async requireContext(userId: string, chatId: number): Promise<ChatContext> {
    const chat = await this.chats.findDetail(userId, chatId);
    if (!chat) throw new NotFoundException(CHAT_NOT_FOUND);
    const character = await this.characters.findOne(userId, chat.character.id);
    if (!character) throw new NotFoundException(CHAT_NOT_FOUND);
    const [persona, template, preset] = await Promise.all([
      chat.persona ? this.personas.findOne(userId, chat.persona.id) : undefined,
      chat.template ? this.templates.findOne(userId, chat.template.id) : undefined,
      chat.preset ? this.presets.findOne(userId, chat.preset.id) : undefined,
    ]);
    return { chat, character, persona: persona ?? null, template: template ?? null, preset: preset ?? null };
  }
}
