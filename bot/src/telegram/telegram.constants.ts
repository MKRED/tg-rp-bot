// Страховочный таймаут запроса для node-fetch@2 (мс). Long polling grammY ждёт по умолчанию
// до 30с, поэтому берём с запасом — 50с. Назначение: зависший сокет (наблюдалось на первом
// холодном соединении через прокси/PuTTY-туннель) иначе стопорит поллер БЕЗ ошибки и навсегда —
// getUpdates не возвращается, апдейты не забираются. С таймаутом node-fetch прерывает запрос,
// grammY ловит сетевую ошибку (handlePollingError) и переподключается с бэкоффом.
export const REQUEST_TIMEOUT_MS = 50_000;

/** Сколько ждать остановки polling при завершении (меньше 10 с до SIGKILL от Docker). */
export const STOP_TIMEOUT_MS = 5_000;

/** DI-токен прокси-агента Telegram (HttpsProxyAgent или undefined, если прокси не задан). */
export const TELEGRAM_PROXY_AGENT = Symbol("TELEGRAM_PROXY_AGENT");

/** callback_data кнопки «Закрыть» под фото из лайтбокса Mini App: кнопку строит me/media, нажатие
 *  обрабатывает telegram/handlers/photo-actions.handler.ts. */
export const PHOTO_CLOSE_CALLBACK = "photo:close";
