/** Логин: латиница в нижнем регистре, цифры и `_ . -`. Сервер приводит ввод к нижнему регистру. */
export const LOGIN_RE = /^[a-z0-9_.-]{3,32}$/;
export const LOGIN_MIN_LENGTH = 3;
export const LOGIN_MAX_LENGTH = 32;

/**
 * Пароль: 8–128 символов. Верхняя граница — защита сервера: хэш scrypt считается от всей строки,
 * и гигантский пароль превращал бы каждый вход в дорогую операцию.
 */
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;

/**
 * Заголовок, который webapp ставит на каждый запрос к /api. Сервер требует его у изменяющих
 * запросов без initData (вход по cookie): чужая страница не может поставить свой заголовок на
 * запрос к нашему домену без CORS — так cookie сессии нельзя использовать с чужого сайта (CSRF).
 */
export const CSRF_HEADER = "X-Requested-With";
export const CSRF_HEADER_VALUE = "tg-rp-bot";

/** Тело POST /api/auth/register и POST /api/auth/login. */
export interface AuthCredentials {
  login: string;
  password: string;
}

/** Ответ GET /api/auth/session — кто вошёл (для webapp вне Telegram, где нет initData). */
export interface AuthSession {
  /** Внутренний id (UUID). */
  id: string;
  /** null — вход по логину не задан (пользователь из Telegram). */
  login: string | null;
  telegramLinked: boolean;
  /** Имя для приветствия: имя из Telegram, иначе логин. */
  displayName: string;
}
