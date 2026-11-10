/**
 * Имя query-параметра, в котором web_app-кнопка бота передаёт Mini App внутренний путь для
 * перехода (deep link). Новые фото в чат уходят без такой кнопки, но под отправленными раньше она
 * осталась — webapp по-прежнему читает параметр при запуске.
 */
export const DEEP_LINK_PARAM = "dl";

/** Разрешённые внутренние пути deep link — защита от подстановки внешних URL/мусора (обе стороны). */
export const DEEP_LINK_PATH_RE = /^\/(characters|personas)\/\d+$/;

/**
 * Потолок фото в чат (длина data URL, ~4,5 МБ бинарных данных): webapp перекодирует картинку в JPEG
 * до 2048 px — детальная картинка из ComfyUI может выйти больше лимита полного фото персонажа.
 * Telegram принимает фото до 10 МБ, JSON-тело бота — до 8 МБ.
 */
export const MAX_SEND_PHOTO_CHARS = 6_000_000;

/** Тело POST /api/me/send-photo — картинка из просмотра себе в чат с ботом (без подписи и ссылки). */
export interface SendPhotoRequest {
  /** Фото как data:image/*;base64,…. */
  image: string;
}

/** Ответ GET /api/me/photo: фото профиля Telegram как data URL; null — нет фото или сбой. */
export interface ProfilePhotoResponse {
  dataUrl: string | null;
}
