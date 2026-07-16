/** Типы фичи narrator («Режиссёр истории»). */

/** Дескриптор аватара в стеке (AvatarStack) — источник записи книги знаний. */
export type StoryAvatarRef = {
  type: "character" | "persona";
  id: number;
  name: string;
  hasImage: boolean;
};

export type StoryListItem = {
  id: number;
  title: string | null;
  bookName: string;
  lastMessage: string | null;
  lastMessageAt: string | null;
  messageCount: number;
  createdAt: string;
  /** Топ-3 (сортировка книги) дескрипторов аватаров — для AvatarStack в списке. */
  avatars: StoryAvatarRef[];
};

export type StoryMessageKind = "beat" | "continue" | "directive";

export type StoryMessage = {
  id: number;
  parentId: number | null;
  role: "user" | "assistant";
  kind: StoryMessageKind;
  content: string;
  /** Кэш переводов { lang: text }; null — переводов нет. */
  translations: Record<string, string> | null;
  createdAt: string;
  siblingIndex: number;
  siblingCount: number;
  siblings: number[];
};

/** Узел дерева истории для графа веток (плоский массив + флаг активного пути). */
export type StoryTreeNode = {
  id: number;
  parentId: number | null;
  role: "user" | "assistant";
  kind: StoryMessageKind;
  content: string;
  isOnActivePath: boolean;
  /** Сообщение попало в диапазон какого-то пересказа — свёрнуто в summary (компонент compact). */
  isCompacted: boolean;
  createdAt: string;
};

/** Настройки истории (перевод + сжатие) — зеркало ChatSettings под narrator. */
export type StorySettings = {
  translateEnabled: boolean;
  translateTargetLang: string;
  /** На каких ходах показывать кнопку: all — все, assistant — биты ИИ, user — директивы. */
  translateScope: "all" | "assistant" | "user";
  autoTranslateScope: "none" | "all" | "assistant" | "user";
  /** Метод перевода закэшированных сообщений (кнопка Globe): Google Translate либо ИИ. */
  translateMethod: "google" | "ai";
  /** Сжатие истории (compact). */
  compactEnabled: boolean;
  compactAutoEnabled: boolean;
  /** Целевой «пол» в токенах (0 = не задано → дефолт на сервере). */
  compactFloorTokens: number;
  compactWords: number;
};

/** Пересказ сжатых сообщений активной ветки (для списка в настройках). */
export type StoryCompaction = {
  id: number;
  seq: number;
  summary: string;
  coveredCount: number;
  coveredTokens: number;
};

export type StoryDetail = {
  id: number;
  title: string | null;
  /** Топ-5 (сортировка книги) дескрипторов аватаров — для AvatarStack в шапке чата. */
  book: { id: number; name: string; avatars: StoryAvatarRef[] };
  template: { id: number; name: string } | null;
  preset: { id: number; name: string } | null;
  premise: string;
  activeMessageId: number | null;
  messages: StoryMessage[];
};

/** Статистика истории (токены) для экрана настроек — зеркало ChatStats без impersonate-вариантов. */
export type StoryStats = {
  tokensTotal: number;
  tokensActiveBranch: number;
  tokensPrompt: number;
  /** Лимит контекста из пресета; null — безграничный или не задан. */
  contextLimit: number | null;
  /** Доступно ли сжатие (есть лимит, достаточно большой, и компонент `compact` включён в шаблоне). */
  compactAvailable: boolean;
  /** Причина недоступности: unlimited | too_small | template_off | null. */
  compactReason: "unlimited" | "too_small" | "template_off" | null;
  /** Включён ли компонент `compact` в шаблоне истории. */
  templateCompactEnabled: boolean;
};

export type StoryCreateInput = {
  bookId: number;
  // Шаблон и пресет обязательны (валидируется на сервере и в БД).
  templateId: number;
  presetId: number;
  openingBeat: string;
  premise: string;
};
