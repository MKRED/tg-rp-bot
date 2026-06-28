/** Разрешённые внутренние пути для кнопки-ссылки под фото (защита от подстановки внешних URL). */
export const DEEP_LINK_RE = /^\/(characters|personas)\/\d+$/;
/** Потолок длины текста инлайн-кнопки Telegram. */
export const MAX_BUTTON_LABEL = 64;
