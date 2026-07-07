export interface ChatListItem {
  id: number;
  title: string | null;
  character: { id: number; name: string; hasImage: boolean };
  persona: { id: number; name: string } | null;
  lastMessage: string | null;
  lastMessageAt: string | null;
  messageCount: number;
  createdAt: string;
}

export interface ChatInput {
  characterId: number;
  personaId: number;
  presetId: number;
  /** Индекс приветствия из character.firstMessages; вне диапазона → чат без стартового сообщения. */
  firstMessageIndex: number;
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
  title: string | null;
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
  autoTranslateScope: "none" | "all" | "assistant" | "user";
  /** Метод перевода закэшированных сообщений (кнопка Globe): Google Translate либо ИИ. */
  translateMethod: "google" | "ai";
}

/**
 * Статистика чата для экрана настроек. Числа считает СЕРВЕР точным BPE-токенайзером (o200k_base),
 * не грубой webapp-эвристикой estimateTokens (она осталась только для «~подсказок» в формах).
 * tokensTotal/tokensActiveBranch — только сообщения; tokensPrompt — полный запрос к LLM по активной
 * ветке (с системными/персонажными промптами, как при генерации).
 */
export interface ChatStats {
  tokensTotal: number;
  tokensActiveBranch: number;
  tokensPrompt: number;
  /** Лимит контекста из пресета; null — безграничный или не задан. */
  contextLimit: number | null;
  impersonationCount: number;
}

/** Сгенерированный вариант реплики «от лица пользователя» (impersonate). */
export interface ImpersonationVariant {
  id: number;
  content: string;
  createdAt: string;
}

export interface TreeNode {
  id: number;
  parentId: number | null;
  role: "user" | "assistant";
  content: string;
  isOnActivePath: boolean;
  createdAt: string;
}
