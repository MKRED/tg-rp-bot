import type { CardCategory } from "@tg-rp-bot/shared";

// Контракт API карточек (форма, строка списка, категории и ask_user, лимиты, дефолты новой
// карточки) — общий с сервером, живёт в @tg-rp-bot/shared. Реэкспорт сохраняет barrel фичи.
// ask_user-состояние категорий форма только показывает: normalizeCardDraft (lib/formDirty.ts)
// не копирует его в CardInput, а сервер отбросил бы его во входе.
export type { AskUserAnswer, AskUserQuestion, CardCategory, CardInput, CardListItem } from "@tg-rp-bot/shared";
export {
  DEFAULT_CARD_CATEGORIES,
  DEFAULT_CARD_PROMPT,
  DEFAULT_CARD_SYSTEM_PROMPT,
  MAX_CARD_CATEGORIES,
  MAX_CARDS_PER_USER,
} from "@tg-rp-bot/shared";

/** Полная карточка, как её отдаёт сервер (GET /cards/:id). */
export interface Card {
  id: number;
  name: string;
  systemPrompt: string;
  prompt: string;
  categories: CardCategory[];
  presetId: number | null;
  useWebSearch: boolean;
  useAskUser: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * Минимальная проекция пресета для пикера внутри CardForm — только то, что нужно для отображения
 * выбора. Фича cards самодостаточна и не импортирует features/generation-presets напрямую (граница
 * фичи, см. CLAUDE.md); страница (CardEditPage) сама тянет полные Preset через usePresets() и
 * маппит в эту форму через presetSummary().
 */
export interface CardPresetOption {
  id: number;
  name: string;
  summary: string;
}
