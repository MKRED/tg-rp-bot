/**
 * Одноразовый бэкфилл шифрования истории RP-чата.
 *
 * Сообщения append-only — они не перезаписываются, поэтому (в отличие от персонажей/персон)
 * существующая история сама не зашифруется при обычной работе. Этот скрипт догоняет старые
 * данные: шифрует messages.content, значения messages.translations и
 * impersonation_variants.content, используя per-user ключ владельца чата (chats.user_id).
 *
 * Идемпотентен: значения с префиксом "v1:" уже зашифрованы и пропускаются — повторный прогон
 * ничего не меняет.
 *
 * Запуск из корня монорепо (нужны DATABASE_URL и ENCRYPTION_KEY в env):
 *   yarn workspace bot exec tsx src/scripts/backfill-message-encryption.ts
 */
import logger from "../logger.js";
import { encryptField, getUserEncryptionKey } from "../utils/index.js";
import { db } from "../db/index.js";
import { sql } from "drizzle-orm";

/** Префикс уже зашифрованных значений (контракт crypto.ts). */
const VERSION_PREFIX = "v1:";

const isEncrypted = (value: string): boolean => value.startsWith(VERSION_PREFIX);

/** Кэш per-user ключей — HKDF дорогой, не выводим его на каждую строку. */
const keyCache = new Map<number, Buffer>();
function keyFor(userId: number): Buffer {
  let key = keyCache.get(userId);
  if (!key) {
    key = getUserEncryptionKey(userId);
    keyCache.set(userId, key);
  }
  return key;
}

async function backfillMessages(): Promise<void> {
  const rows = (await db.execute(sql`
    SELECT m.id, m.content, m.translations, c.user_id
    FROM messages m
    JOIN chats c ON c.id = m.chat_id
  `)) as unknown as {
    id: number | string;
    content: string;
    translations: Record<string, string> | null;
    user_id: number | string;
  }[];

  let updated = 0;
  let skipped = 0;
  let translationValuesEncrypted = 0;

  for (const r of rows) {
    const id = Number(r.id);
    const key = keyFor(Number(r.user_id));

    let changed = false;

    // content
    const newContent = isEncrypted(r.content) ? r.content : encryptField(r.content, key);
    if (newContent !== r.content) changed = true;

    // translations — шифруем каждое значение без префикса v1:; ключи (коды языков) не трогаем
    let newTranslations: Record<string, string> | null = r.translations;
    if (r.translations) {
      const out: Record<string, string> = {};
      let tChanged = false;
      for (const [lang, text] of Object.entries(r.translations)) {
        if (isEncrypted(text)) {
          out[lang] = text;
        } else {
          out[lang] = encryptField(text, key);
          tChanged = true;
          translationValuesEncrypted++;
        }
      }
      if (tChanged) {
        newTranslations = out;
        changed = true;
      }
    }

    if (!changed) {
      skipped++;
      continue;
    }

    await db.execute(sql`
      UPDATE messages
      SET content = ${newContent},
          translations = ${newTranslations ? JSON.stringify(newTranslations) : null}::jsonb
      WHERE id = ${id}
    `);
    updated++;
  }

  logger.info(
    { total: rows.length, updated, skipped, translationValuesEncrypted },
    "Backfill messages completed",
  );
}

async function backfillVariants(): Promise<void> {
  const rows = (await db.execute(sql`
    SELECT iv.id, iv.content, c.user_id
    FROM impersonation_variants iv
    JOIN chats c ON c.id = iv.chat_id
  `)) as unknown as {
    id: number | string;
    content: string;
    user_id: number | string;
  }[];

  let updated = 0;
  let skipped = 0;

  for (const r of rows) {
    if (isEncrypted(r.content)) {
      skipped++;
      continue;
    }
    const key = keyFor(Number(r.user_id));
    await db.execute(sql`
      UPDATE impersonation_variants
      SET content = ${encryptField(r.content, key)}
      WHERE id = ${Number(r.id)}
    `);
    updated++;
  }

  logger.info({ total: rows.length, updated, skipped }, "Backfill impersonation variants completed");
}

async function main(): Promise<void> {
  const t0 = Date.now();
  logger.info("Backfill message encryption started");
  await backfillMessages();
  await backfillVariants();
  logger.info({ durationMs: Date.now() - t0 }, "Backfill message encryption finished");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    logger.error({ err }, "Backfill message encryption failed");
    process.exit(1);
  });
