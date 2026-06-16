import { decryptField, getUserEncryptionKey } from "../../utils/index.js";
import type { Message } from "../schema.js";

/**
 * Расшифровывает значения кэша переводов (ключи — коды языков — остаются открытыми).
 * null → null. Legacy-plaintext значения возвращаются как есть (см. decryptField).
 */
export function decryptTranslations(
  translations: Record<string, string> | null,
  key: Buffer,
): Record<string, string> | null {
  if (!translations) return null;
  const out: Record<string, string> = {};
  for (const [lang, text] of Object.entries(translations)) {
    out[lang] = decryptField(text, key);
  }
  return out;
}

/** Расшифровывает зашифрованные поля строки сообщения (content + значения translations). */
export function decryptMessageRow(row: Message, userId: number): Message {
  const key = getUserEncryptionKey(userId);
  return {
    ...row,
    content: decryptField(row.content, key),
    translations: decryptTranslations(row.translations, key),
  };
}
