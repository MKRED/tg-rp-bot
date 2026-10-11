import { ROUTES } from "../../../app/routes";

/** Параметр экрана входа: путь, на который вернуть после входа. */
export const FROM_PARAM = "from";

/**
 * Путь экрана входа с возвратом на `from` (путь + query текущего маршрута). Главную и сам экран входа
 * в `from` не кладём — после входа и так попадём на главную.
 */
export function loginPath(from?: string): string {
  if (!from || from === ROUTES.home || isLoginPath(from)) return ROUTES.login;
  return `${ROUTES.login}?${new URLSearchParams({ [FROM_PARAM]: from }).toString()}`;
}

/**
 * Куда вернуть после входа. `from` приходит из адресной строки, поэтому принимаем только внутренний
 * путь приложения: начинается с одного «/» (не «//host» и не «/\host» — браузер считает их адресом
 * другого сайта) и не ведёт обратно на вход (иначе петля). Всё прочее — на главную.
 */
export function safeReturnPath(from: string | null): string {
  if (!from || !from.startsWith("/") || from.startsWith("//") || from.startsWith("/\\")) return ROUTES.home;
  if (from.includes("://") || isLoginPath(from)) return ROUTES.home;
  return from;
}

function isLoginPath(path: string): boolean {
  return path === ROUTES.login || path.startsWith(`${ROUTES.login}?`) || path.startsWith(`${ROUTES.login}/`);
}
