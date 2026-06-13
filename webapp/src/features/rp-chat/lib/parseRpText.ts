export type RpTokenType = "action" | "speech" | "thought" | "plain";

export interface RpToken {
  type: RpTokenType;
  text: string;
}

/**
 * Разбивает RP-текст на токены по нотации:
 *   *действие/нарратив*  → action (italic, hint-color)
 *   "фраза"              → speech (обычный текст, кавычки сохраняются)
 *   «мысль»              → thought (italic, link-color)
 *
 * Каждый вызов создаёт новый RegExp чтобы lastIndex (флаг g) не сохранялся между вызовами.
 */
export function parseRpText(input: string): RpToken[] {
  const tokens: RpToken[] = [];
  const regex = /\*([^*]+)\*|"([^"]+)"|«([^»]+)»/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(input)) !== null) {
    if (match.index > lastIndex) {
      tokens.push({ type: "plain", text: input.slice(lastIndex, match.index) });
    }
    if (match[1] !== undefined) {
      tokens.push({ type: "action", text: match[1] });
    } else if (match[2] !== undefined) {
      tokens.push({ type: "speech", text: `"${match[2]}"` });
    } else {
      tokens.push({ type: "thought", text: `«${match[3]}»` });
    }
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < input.length) {
    tokens.push({ type: "plain", text: input.slice(lastIndex) });
  }

  return tokens;
}
