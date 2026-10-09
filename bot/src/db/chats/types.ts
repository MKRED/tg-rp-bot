// Публичные типы домена чатов (раскладка db/chats/ по обязанностям). То, что уходит в webapp по
// сети, — контракт API из @tg-rp-bot/shared.
import type { ChatSettings } from "@tg-rp-bot/shared";

export type { ChatDetail, ChatListItem, MessageInPath, TreeNode } from "@tg-rp-bot/shared";

/** Аргумент DAO createChat (выбранное приветствие передаётся отдельно, уже текстом). */
export type ChatInput = {
  characterId: number;
  personaId: number;
  templateId: number;
  presetId: number;
};

/** Оценка объёма чата в токенах: весь чат (все ветки) и текущая активная ветка. */
export type ChatTokenStats = {
  tokensTotal: number;
  tokensActiveBranch: number;
};

export type ChatSettingsRow = ChatSettings;
