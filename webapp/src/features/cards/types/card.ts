/** Категория структуры карточки — редактируемый блок (заголовок + пример формата + сгенерированный текст). */
export interface CardCategory {
  id: string;
  title: string;
  description: string;
  content: string;
  enabled: boolean;
}

/** Полная карточка, как её отдаёт сервер (GET /cards/:id). */
export interface Card {
  id: number;
  name: string;
  prompt: string;
  categories: CardCategory[];
  presetId: number | null;
  createdAt: string;
  updatedAt: string;
}

/** Строка списка (GET /cards) — имя + дата обновления для «Мастерской». */
export interface CardListItem {
  id: number;
  name: string;
  updatedAt: string;
}

/** Тело формы создания/редактирования (POST/PUT). */
export interface CardInput {
  name: string;
  prompt: string;
  categories: CardCategory[];
  presetId: number | null;
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

/** Мягкий лимит — дублирует серверный (bot/src/server/cards/cards.constants.ts), блокирует UI заранее. */
export const MAX_CARDS_PER_USER = 50;

/** Максимум категорий структуры — дублирует MAX_CARD_CATEGORIES (bot/src/server/cards/cards.constants.ts). */
export const MAX_CARD_CATEGORIES = 30;

/**
 * Дефолтный основной промпт новой карточки — дублирует DEFAULT_CARD_PROMPT
 * (bot/src/db/cards/cards.constants.ts). Показывается сразу в форме создания, ещё до первого
 * сохранения (сервер применил бы тот же дефолт только на вставке, но тогда пользователь не увидел
 * бы структуру до первого клика «Сохранить»).
 */
export const DEFAULT_CARD_PROMPT = "Create a highly detailed AI character card";

/**
 * Дефолтная структура карточки — дублирует DEFAULT_CARD_CATEGORIES
 * (bot/src/db/cards/cards.constants.ts). См. DEFAULT_CARD_PROMPT — тот же повод для дублирования.
 */
export const DEFAULT_CARD_CATEGORIES: CardCategory[] = [
  { id: "base", title: "Base", description: "Name: ...\nRace: ...\nSex: ...\nAge: ...\nHeight: ...", content: "", enabled: true },
  { id: "body", title: "Body", description: "Подробное описание телосложения, черт лица, особых примет.", content: "", enabled: true },
  { id: "outfit", title: "Outfit", description: "Повседневный наряд персонажа, аксессуары.", content: "", enabled: true },
  { id: "personality", title: "Personality", description: "Черты характера, ценности, страхи, мотивация.", content: "", enabled: true },
  { id: "speechStyle", title: "Speech Style", description: "Манера речи, характерные фразы, тон.", content: "", enabled: true },
  { id: "behaviours", title: "Behaviours", description: "Типичные привычки и реакции в разных ситуациях.", content: "", enabled: true },
  { id: "hobbiesLikes", title: "Hobbies / Likes", description: "Увлечения и то, что персонажу нравится.", content: "", enabled: true },
  { id: "dislikes", title: "Dislikes", description: "То, что персонаж не любит или чего избегает.", content: "", enabled: true },
  { id: "background", title: "Background", description: "История персонажа, прошлое, ключевые события.", content: "", enabled: true },
];
