/** Общая валидация формата API-ключа (DeepSeek/Tavily — оба BYOK, PATCH /settings/<provider>). */

const MAX_KEY_LENGTH = 200;
// Отклоняем пробелы/переводы строк внутри ключа — частый баг копипасты из мессенджера: ключ с "\n"
// уходит в Authorization-заголовок и undici бросает малопонятный "Invalid header value".
const INVALID_KEY_CHARS = /[\s\x00-\x1f]/;

/** true — ключ прошёл базовую проверку формата (не пустой, без пробелов/управляющих символов, не длиннее лимита). */
export function isValidKeyFormat(trimmed: string): boolean {
  return Boolean(trimmed) && !INVALID_KEY_CHARS.test(trimmed) && trimmed.length <= MAX_KEY_LENGTH;
}

export const INVALID_KEY_FORMAT_RESPONSE = {
  error: "invalid_key_format",
  message: "Некорректный ключ: проверьте, не попали ли лишние пробелы или перевод строки.",
} as const;
