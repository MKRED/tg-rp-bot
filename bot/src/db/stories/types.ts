// Публичные типы домена narrator-историй. Контракт (то, что уходит в webapp) — из @tg-rp-bot/shared.

export type { StoryAvatarRef, StoryDetail, StoryListItem, StoryMessage, StorySettings, StoryTreeNode } from "@tg-rp-bot/shared";

export type StoryInput = {
  bookId: number;
  templateId: number;
  presetId: number;
};

/** Оценка объёма истории в токенах: вся история (все ветки) и текущая активная ветка. */
export type StoryTokenStats = {
  tokensTotal: number;
  tokensActiveBranch: number;
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
