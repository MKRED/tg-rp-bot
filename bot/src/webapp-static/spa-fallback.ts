import path from "node:path";

/** Пути, которые обслуживает Nest: их не перехватывают ни статика, ни SPA-fallback. */
const SERVER_PATHS = ["/api", "/health"];

/**
 * Отдавать ли index.html на запрос, не нашедшийся среди файлов сборки: GET/HEAD вне путей сервера и
 * без расширения файла — маршрут React-приложения. Неизвестный /api/* уходит дальше в Nest и получает
 * JSON 404, а не страницу приложения. Отсутствующий файл (/assets/old-hash.js у клиента со старым
 * кэшем после деплоя) — тоже 404: HTML вместо скрипта дал бы невнятную ошибку парсинга.
 */
export function shouldServeSpaIndex(method: string, urlPath: string): boolean {
  if (method !== "GET" && method !== "HEAD") return false;
  if (path.posix.extname(urlPath) !== "") return false;
  return !SERVER_PATHS.some((prefix) => urlPath === prefix || urlPath.startsWith(`${prefix}/`));
}
