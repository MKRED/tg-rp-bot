// Публичные типы домена narrator-историй.

export type StoryInput = {
  bookId: number;
  templateId: number | null;
  presetId: number | null;
};

/** Сообщение активного пути истории с информацией о сиблингах (для стрелок ← → в UI). */
export type StoryMessageInPath = {
  id: number;
  parentId: number | null;
  role: "user" | "assistant";
  kind: "beat" | "continue" | "directive";
  content: string;
  createdAt: string;
  siblingIndex: number;
  siblingCount: number;
  siblings: number[];
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
