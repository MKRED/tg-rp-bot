/**
 * Матчинг триггер-слов книги знаний (activation="keyword") в тексте последних сообщений истории.
 * Матчинг по границе слова (не подстрока), регистронезависимо. Стандартный \b в JS regex построен
 * на \w = [A-Za-z0-9_] и не включает кириллицу — на кириллическом тексте он расставляет границы
 * почти везде и даёт массу ложных срабатываний. Вместо него — ручной lookaround по Unicode-классам
 * \p{L} (любая буква)/\p{N} (любая цифра), одинаково корректный для латиницы и кириллицы.
 */

const SPECIAL_CHARS_RE = /[.*+?^${}()|[\]\\]/g;

/** Экранирует спецсимволы regex во введённом пользователем триггер-слове. */
function escapeRegExp(s: string): string {
  return s.replace(SPECIAL_CHARS_RE, "\\$&");
}

/** ё/Ё → е/Е — снимает частый класс промахов («мёд» ⟷ «мед») без полноценного стемминга. */
function normalizeYo(s: string): string {
  return s.replace(/ё/g, "е").replace(/Ё/g, "Е");
}

/** Строит regex одного триггер-слова: границы — lookaround по (не)буквам/(не)цифрам с обеих сторон. */
function buildWordBoundaryRegex(keyword: string): RegExp {
  return new RegExp(`(?<![\\p{L}\\p{N}_])${escapeRegExp(keyword)}(?![\\p{L}\\p{N}_])`, "iu");
}

/**
 * true, если хотя бы одно из keywords встречается в windowText как отдельное слово (или фраза).
 * windowText — уже склеенное вызывающим кодом окно последних N сообщений (через "\n" — перевод
 * строки не входит в [\p{L}\p{N}_], так что заодно работает доп. границей между сообщениями).
 */
export function matchesTriggerKeywords(windowText: string, keywords: string[]): boolean {
  if (keywords.length === 0 || !windowText.trim()) return false;
  const text = normalizeYo(windowText);
  return keywords.some((raw) => {
    const keyword = normalizeYo(raw.trim());
    if (!keyword) return false;
    return buildWordBoundaryRegex(keyword).test(text);
  });
}
