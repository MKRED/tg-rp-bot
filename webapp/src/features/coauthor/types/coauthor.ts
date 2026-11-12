// Контракт API соавтора живёт в @tg-rp-bot/shared; реэкспорт держит barrel фичи независимым от пакета.
export type {
  CoauthorAnswerInput,
  CoauthorBlock,
  CoauthorCard,
  CoauthorChat,
  CoauthorChatInput,
  CoauthorChatListItem,
  CoauthorFeedItem,
  CoauthorProposal,
  CoauthorReviewResult,
  CoauthorStep,
  CoauthorStepEvent,
  CoauthorStreamError,
} from "@tg-rp-bot/shared";
export {
  COAUTHOR_LIMITS,
  COAUTHOR_MESSAGE_MAX_LENGTH,
  DEFAULT_COAUTHOR_SYSTEM_PROMPT,
  MAX_COAUTHOR_CARDS,
  MAX_COAUTHOR_CHATS_PER_USER,
} from "@tg-rp-bot/shared";

/** Пресет для выбора в настройках чата — страница маппит его из generation-presets (границы фич). */
export interface CoauthorPresetOption {
  id: number;
  name: string;
  summary: string;
  /** Модель пресета видит картинки (иначе тумблер «Учитывать картинки» недоступен). */
  supportsImages: boolean;
}

/** Карточка для выбора в чат. */
export interface CoauthorCardOption {
  id: number;
  name: string;
}
