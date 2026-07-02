// Публичные типы домена narrator-историй.

export type StoryInput = {
  bookId: number;
  templateId: number;
  presetId: number;
};

/** Сообщение активного пути истории с информацией о сиблингах (для стрелок ← → в UI). */
export type StoryMessageInPath = {
  id: number;
  parentId: number | null;
  role: "user" | "assistant";
  kind: "beat" | "continue" | "directive";
  content: string;
  /** Кэш переводов { lang: text } — расшифрован. null, если переводов нет. */
  translations: Record<string, string> | null;
  createdAt: string;
  siblingIndex: number;
  siblingCount: number;
  siblings: number[];
};

/** Узел дерева истории плоским массивом с флагом активного пути — для страницы графа. */
export type StoryTreeNode = {
  id: number;
  parentId: number | null;
  role: "user" | "assistant";
  kind: "beat" | "continue" | "directive";
  content: string;
  isOnActivePath: boolean;
  /** Сообщение попало в диапазон какого-то пересказа (fromAnchorId, toAnchorId] — свёрнуто в summary. */
  isCompacted: boolean;
  createdAt: string;
};

/** Оценка объёма истории в токенах: вся история (все ветки) и текущая активная ветка. */
export type StoryTokenStats = {
  tokensTotal: number;
  tokensActiveBranch: number;
};

/** Настройки истории (значения из story_settings либо дефолты): перевод + сжатие (compact). */
export type StorySettingsRow = {
  translateEnabled: boolean;
  translateTargetLang: string;
  translateScope: "all" | "assistant" | "user";
  autoTranslateScope: "none" | "all" | "assistant" | "user";
  compactEnabled: boolean;
  compactAutoEnabled: boolean;
  compactFloorTokens: number;
  compactWords: number;
};

/** Пересказ сжатого диапазона активной ветки (summary расшифрован). */
export type StoryCompactionRow = {
  id: number;
  seq: number;
  fromAnchorId: number | null;
  toAnchorId: number;
  summary: string;
  coveredCount: number;
  coveredTokens: number;
  createdAt: string;
};

export type StoryDetail = {
  id: number;
  title: string | null;
  book: { id: number; name: string };
  template: { id: number; name: string } | null;
  preset: { id: number; name: string } | null;
  /** Системная вводная (опц.) — расшифрована. */
  premise: string;
  activeMessageId: number | null;
  messages: StoryMessageInPath[];
};

export type StoryListItem = {
  id: number;
  title: string | null;
  bookName: string;
  lastMessage: string | null;
  lastMessageAt: string | null;
  messageCount: number;
  createdAt: string;
};
