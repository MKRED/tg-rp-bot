// Публичные типы домена чатов (раскладка db/chats/ по обязанностям).

export type ChatInput = {
  characterId: number;
  personaId: number;
  presetId: number;
};

/**
 * Одно сообщение активного пути с информацией о сиблингах.
 * siblings — упорядоченные ID сиблингов (created_at ASC), нужны стрелкам ← → в UI.
 */
export type MessageInPath = {
  id: number;
  parentId: number | null;
  role: "user" | "assistant";
  content: string;
  translations: Record<string, string> | null;
  createdAt: string;
  siblingIndex: number;
  siblingCount: number;
  siblings: number[];
};

export type ChatDetail = {
  id: number;
  title: string | null;
  character: { id: number; name: string; hasImage: boolean };
  persona: { id: number; name: string; hasImage: boolean } | null;
  preset: { id: number; name: string } | null;
  activeMessageId: number | null;
  messages: MessageInPath[];
};

export type ChatListItem = {
  id: number;
  title: string | null;
  character: { id: number; name: string; hasImage: boolean };
  persona: { id: number; name: string } | null;
  lastMessage: string | null;
  lastMessageAt: string | null;
  messageCount: number;
  createdAt: string;
};

export type TreeNode = {
  id: number;
  parentId: number | null;
  role: "user" | "assistant";
  content: string;
  isOnActivePath: boolean;
  createdAt: string;
};

/** Оценка объёма чата в токенах: весь чат (все ветки) и текущая активная ветка. */
export type ChatTokenStats = {
  tokensTotal: number;
  tokensActiveBranch: number;
};

export type ChatSettingsRow = {
  translateEnabled: boolean;
  translateTargetLang: string;
  translateScope: "all" | "assistant" | "user";
  autoTranslateScope: "none" | "all" | "assistant" | "user";
  translateMethod: "google" | "ai";
};
