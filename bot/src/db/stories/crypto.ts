import { decryptField } from "../../utils/index.js";

/**
 * Расшифровывает значения кэша переводов бита/директивы (ключи — коды языков — открыты).
 * null → null. Legacy-plaintext значения возвращаются как есть (см. decryptField).
 * Зеркало db/chats/crypto.ts decryptTranslations под story_messages.
 */
export function decryptStoryTranslations(
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
