import https from "node:https";
import { bot, telegramProxyAgent } from "../../bot.js";
import { config } from "../../config.js";
import logger from "../../logger.js";
import { CACHE_TTL_MS } from "./profilePhoto.constants.js";
import type { CacheEntry } from "./profilePhoto.types.js";

/**
 * Фото профиля пользователя через Bot API → data URL для Mini App.
 *
 * Зачем не из initData: Telegram кладёт user.photo_url в initData ТОЛЬКО для Mini App,
 * запущенных из attachment-меню. У нашего бота запуск кнопкой/меню — поля там нет, поэтому
 * берём фото серверно: getUserProfilePhotos → getFile → скачиваем файл (через тот же
 * Telegram-прокси) и кодируем в base64. Отдаём webapp одной строкой data:image/...;base64,…
 *
 * Кэш в памяти: фото профиля меняется редко, а запросы /me/photo идут на каждый вход —
 * незачем дёргать Bot API и качать файл повторно.
 */
const cache = new Map<number, CacheEntry>();

/** Скачивает файл по URL через прокси-агент Telegram (node-fetch/undici тут не годятся — см. proxy.ts). */
function downloadFile(url: string): Promise<{ buffer: Buffer; contentType: string }> {
  return new Promise((resolve, reject) => {
    // agent опционален: вне прокси-конфигурации (telegramProxyAgent undefined) идём напрямую.
    https
      .get(url, { agent: telegramProxyAgent }, (res) => {
        if (res.statusCode !== 200) {
          res.resume(); // освобождаем сокет
          reject(new Error(`File download failed: HTTP ${res.statusCode}`));
          return;
        }
        const contentType = res.headers["content-type"] ?? "image/jpeg";
        const chunks: Buffer[] = [];
        res.on("data", (chunk: Buffer) => chunks.push(chunk));
        res.on("end", () => resolve({ buffer: Buffer.concat(chunks), contentType }));
        res.on("error", reject);
      })
      .on("error", reject);
  });
}

/**
 * data URL фото профиля пользователя или null (нет фото / скрыто настройками приватности).
 * Бросает только при неожиданных сбоях сети/API — вызывающий (роут) их логирует и отдаёт null.
 */
export async function getProfilePhotoDataUrl(userId: number): Promise<string | null> {
  const cached = cache.get(userId);
  if (cached && cached.expires > Date.now()) return cached.dataUrl;

  const t0 = Date.now();
  // Берём один (самый свежий) набор размеров одного фото
  const photos = await bot.api.getUserProfilePhotos(userId, { limit: 1 });
  // photos[0] отсортирован по возрастанию размера — берём самый крупный
  const sizes = photos.photos[0] ?? [];
  const largest = sizes[sizes.length - 1];
  if (!largest) {
    cache.set(userId, { dataUrl: null, expires: Date.now() + CACHE_TTL_MS });
    logger.debug({ userId }, "User has no accessible profile photo");
    return null;
  }

  const file = await bot.api.getFile(largest.file_id);
  if (!file.file_path) {
    logger.warn({ userId, fileId: largest.file_id }, "getFile returned no file_path");
    return null;
  }

  // URL содержит BOT_TOKEN — НИКОГДА не логируем его целиком, только file_path/размер.
  const url = `https://api.telegram.org/file/bot${config.botToken}/${file.file_path}`;
  const { buffer, contentType } = await downloadFile(url);
  const dataUrl = `data:${contentType};base64,${buffer.toString("base64")}`;

  cache.set(userId, { dataUrl, expires: Date.now() + CACHE_TTL_MS });
  logger.info(
    { userId, filePath: file.file_path, bytes: buffer.length, durationMs: Date.now() - t0 },
    "Profile photo fetched",
  );
  return dataUrl;
}
