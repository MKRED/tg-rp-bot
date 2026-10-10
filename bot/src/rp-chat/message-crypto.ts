import type { Message } from "../db/schema.js";
import { decryptField, decryptTranslations } from "../utils/index.js";

/** Расшифровывает зашифрованные поля строки сообщения (content + значения translations). */
export function decryptMessageRow(row: Message, key: Buffer): Message {
  return {
    ...row,
    content: decryptField(row.content, key),
    translations: decryptTranslations(row.translations, key),
  };
}
