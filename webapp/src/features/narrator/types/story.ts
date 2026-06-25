/** Типы фичи narrator («Режиссёр истории»). */

export type StoryListItem = {
  id: number;
  title: string | null;
  bookName: string;
  lastMessage: string | null;
  lastMessageAt: string | null;
  messageCount: number;
  createdAt: string;
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

/** Настройки перевода истории — зеркало ChatSettings под narrator. */
export type StorySettings = {
  translateEnabled: boolean;
  translateTargetLang: string;
  /** На каких ходах показывать кнопку: all — все, assistant — биты ИИ, user — директивы. */
  translateScope: "all" | "assistant" | "user";
  autoTranslateScope: "none" | "all" | "assistant" | "user";
};

export type StoryDetail = {
  id: number;
  title: string | null;
  book: { id: number; name: string };
  template: { id: number; name: string } | null;
  preset: { id: number; name: string } | null;
  premise: string;
  activeMessageId: number | null;
  messages: StoryMessage[];
};

export type StoryCreateInput = {
  bookId: number;
  // Шаблон и пресет обязательны (валидируется на сервере и в БД).
  templateId: number;
  presetId: number;
  openingBeat: string;
  premise: string;
};
