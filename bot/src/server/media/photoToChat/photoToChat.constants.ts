/**
 * Имя query-параметра, в котором web_app-кнопка передаёт Mini App внутренний путь для перехода
 * (deep link). webapp читает его при запуске (resolveDeepLink в webapp/src/app/deepLink.ts) и
 * навигирует на этот путь. Значение согласовано с webapp — менять только синхронно.
 */
export const DEEP_LINK_PARAM = "dl";
