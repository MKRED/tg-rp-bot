// Контракт API шаблонов карточек (/api/card-templates) — общий для bot и webapp.
import { DEFAULT_CARD_CATEGORIES, DEFAULT_CARD_SYSTEM_PROMPT, type CardField } from "./cards.js";

/**
 * Тело формы создания/правки шаблона (POST/PUT). Шаблон — заготовка для карточки «Мастерской»:
 * при выборе всё это копируется в карточку (дальше карточка живёт своей копией, правка шаблона её
 * не меняет). Основной промпт, референсы и пресет ИИ в шаблон не входят — они про конкретного персонажа.
 */
export interface CardTemplateInput {
  name: string;
  systemPrompt: string;
  /** Поля структуры; порядок массива = порядок генерации блоков карточки. */
  fields: CardField[];
  useWebSearch: boolean;
  useAskUser: boolean;
  askUserFirst: boolean;
}

/** Шаблон, как его отдаёт сервер — и в списке, и по id: он небольшой, а пикеру нужен целиком. */
export interface CardTemplate extends CardTemplateInput {
  id: number;
  /** ISO-строка. */
  createdAt: string;
  /** ISO-строка. */
  updatedAt: string;
}

// Мягкий лимит: webapp блокирует UI заранее, сервер проверяет последней линией защиты.
export const MAX_CARD_TEMPLATES_PER_USER = 50;

/**
 * Встроенный шаблон «Стандартный» — дефолты новой карточки (системный промпт и поля). В БД не
 * хранится и не редактируется: webapp показывает его первым в выборе шаблона и берёт за основу
 * нового пользовательского шаблона.
 */
export const STANDARD_CARD_TEMPLATE: CardTemplateInput = {
  name: "Стандартный",
  systemPrompt: DEFAULT_CARD_SYSTEM_PROMPT,
  fields: DEFAULT_CARD_CATEGORIES.map(({ id, title, description, enabled }) => ({ id, title, description, enabled })),
  useWebSearch: false,
  useAskUser: false,
  askUserFirst: false,
};
