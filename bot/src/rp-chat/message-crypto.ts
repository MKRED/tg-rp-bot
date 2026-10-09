import type { Message } from "../db/schema.js";
import { decryptField, decryptTranslations, getUserEncryptionKey } from "../utils/index.js";

/** Расшифровывает зашифрованные поля строки сообщения (content + значения translations). */
export function decryptMessageRow(row: Message, userId: number): Message {
  const key = getUserEncryptionKey(userId);
  return {
    ...row,
    content: decryptField(row.content, key),
    translations: decryptTranslations(row.translations, key),
  };
}
