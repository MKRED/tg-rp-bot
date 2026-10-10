import {
  LOGIN_MAX_LENGTH,
  LOGIN_MIN_LENGTH,
  LOGIN_RE,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
} from "@tg-rp-bot/shared";

export type AuthFormMode = "login" | "register";

export interface CredentialsInput {
  login: string;
  password: string;
  /** Повтор пароля — только при регистрации. */
  repeat?: string;
}

/** Логин в том виде, в каком его хранит сервер: без пробелов по краям, в нижнем регистре. */
export function normalizeLogin(login: string): string {
  return login.trim().toLowerCase();
}

/**
 * Проверка формы до запроса — те же правила, что у сервера (лимиты из @tg-rp-bot/shared), чтобы
 * ошибка показывалась сразу. null — всё в порядке. При входе формат логина не проверяем подробно:
 * сервер и так ответит «неверный логин или пароль».
 */
export function validateCredentials(mode: AuthFormMode, input: CredentialsInput): string | null {
  const login = normalizeLogin(input.login);
  if (!login) return "Введите логин";
  if (!input.password) return "Введите пароль";
  if (mode === "login") return null;

  if (!LOGIN_RE.test(login)) {
    return `Логин: ${LOGIN_MIN_LENGTH}–${LOGIN_MAX_LENGTH} символов, латиница, цифры и _ . -`;
  }
  if (input.password.length < PASSWORD_MIN_LENGTH || input.password.length > PASSWORD_MAX_LENGTH) {
    return `Пароль: от ${PASSWORD_MIN_LENGTH} до ${PASSWORD_MAX_LENGTH} символов`;
  }
  if (input.password !== input.repeat) return "Пароли не совпадают";
  return null;
}
