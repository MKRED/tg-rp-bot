export interface ChatListItem {
  id: number;
  character: { id: number; name: string; hasImage: boolean };
  persona: { id: number; name: string } | null;
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

/**
 * Одно сообщение активного пути с информацией о сиблингах.
 * siblings — упорядоченные ID сиблингов для стрелок ← →.
 */
export interface MessageInPath {
  id: number;
  parentId: number | null;
  role: "user" | "assistant";
  content: string;
  translations: Record<string, string> | null;
  createdAt: string;
  siblingIndex: number;
  siblingCount: number;
  siblings: number[];
}

export interface ChatDetail {
  id: number;
  character: { id: number; name: string; hasImage: boolean };
  persona: { id: number; name: string; hasImage: boolean } | null;
  preset: { id: number; name: string } | null;
  activeMessageId: number | null;
  messages: MessageInPath[];
}

export interface ChatSettings {
  translateEnabled: boolean;
  translateTargetLang: string;
  translateScope: "all" | "assistant" | "user";
}

export interface TreeNode {
  id: number;
  parentId: number | null;
  role: "user" | "assistant";
  content: string;
  isOnActivePath: boolean;
  createdAt: string;
}
