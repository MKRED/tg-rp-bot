export interface ChatListItem {
  id: number;
  characterId: number;
  characterName: string;
  characterHasImage: boolean;
  personaId: number | null;
  personaName: string | null;
  /** Текст последнего сообщения (для превью в ячейке). */
  lastMessage: string | null;
  lastMessageAt: string | null;
  messageCount: number;
  createdAt: string;
}

export interface ChatInput {
  characterId: number;
  personaId: number | null;
  presetId: number | null;
}

/** Ответ сервера при создании чата. */
export interface ChatCreated {
  id: number;
}
