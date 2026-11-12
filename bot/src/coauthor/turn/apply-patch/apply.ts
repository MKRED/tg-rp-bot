import type { PatchHunk } from "./parse.js";

export type ApplyHunksResult = { ok: true; text: string } | { ok: false; error: string };

/** Начало фрагмента для сообщения об ошибке — модели хватает, чтобы понять, о каком ханке речь. */
function excerpt(text: string): string {
  const oneLine = text.replace(/\s+/g, " ").trim();
  return oneLine.length > 80 ? `${oneLine.slice(0, 80)}…` : oneLine;
}

function countOccurrences(text: string, fragment: string): number {
  let count = 0;
  for (let at = text.indexOf(fragment); at !== -1; at = text.indexOf(fragment, at + 1)) count++;
  return count;
}

/**
 * Применяет ханки к тексту блока по порядку. Ханк — это «найти фрагмент, заменить», а не сравнение
 * строк: для блока-абзаца модель пишет в `-` кусок строки («-и зелёные глаза»), и это должно работать.
 * Фрагмент обязан встречаться ровно один раз — иначе непонятно, что менять, и модель получает просьбу
 * добавить контекст. Ханк без `-` и контекста допустим только для пустого блока (это заполнение).
 */
export function applyHunks(text: string, hunks: PatchHunk[]): ApplyHunksResult {
  let current = text.replace(/\r\n?/g, "\n");
  for (const hunk of hunks) {
    if (hunk.old === "") {
      if (current.trim() !== "") {
        return { ok: false, error: "a hunk has only \"+\" lines — add context lines to show where to insert, or rewrite the block with edit_block" };
      }
      current = hunk.new;
      continue;
    }
    let found = countOccurrences(current, hunk.old);
    let from = hunk.old;
    let to = hunk.new;
    if (found === 0 && hunk.old.trim() !== hunk.old) {
      // Лишние пробелы или переводы строк по краям фрагмента — частая неточность, текст при этом верный.
      from = hunk.old.trim();
      to = hunk.new.trim();
      found = countOccurrences(current, from);
    }
    if (found === 0) {
      return { ok: false, error: `fragment not found: "${excerpt(hunk.old)}" — copy the "-" and context lines exactly from the current text` };
    }
    if (found > 1) {
      return { ok: false, error: `fragment "${excerpt(hunk.old)}" occurs ${found} times — add context lines to pick one` };
    }
    current = current.replace(from, () => to);
  }
  return { ok: true, text: current };
}
