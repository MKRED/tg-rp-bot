/**
 * Имя query-параметра, в котором web_app-кнопка бота передаёт Mini App внутренний путь для
 * перехода (deep link): бот строит кнопку под фото, webapp читает параметр при запуске.
 */
export const DEEP_LINK_PARAM = "dl";

/** Разрешённые внутренние пути deep link — защита от подстановки внешних URL/мусора (обе стороны). */
export const DEEP_LINK_PATH_RE = /^\/(characters|personas)\/\d+$/;

/** Потолок длины текста инлайн-кнопки Telegram: длиннее подпись обрезается. */
export const MAX_PHOTO_BUTTON_LABEL = 64;

/** Тело POST /api/me/send-photo — фото из лайтбокса себе в чат с ботом. */
export interface SendPhotoRequest {
  /** Фото как data:image/*;base64,… (некадрированный оригинал из лайтбокса). */
  image: string;
  /** Текст кнопки-ссылки = имя персонажа/персоны. */
  label: string;
  /** Внутренний путь Mini App для кнопки-ссылки: "/characters/:id" | "/personas/:id". */
  deepLink: string;
}

/** Ответ GET /api/me/photo: фото профиля Telegram как data URL; null — нет фото или сбой. */
export interface ProfilePhotoResponse {
  dataUrl: string | null;
}
