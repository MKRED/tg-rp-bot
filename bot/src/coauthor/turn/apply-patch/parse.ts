/**
 * Разбор патча apply_patch в формате Codex (его DeepSeek выдаёт для custom-инструмента apply_patch):
 *
 *   *** Begin Patch
 *   *** Update File: cards/3/look.md
 *   @@
 *    контекстная строка
 *   -старая строка
 *   +новая строка
 *   *** End Patch
 *
 * Формат официально не описан, поэтому разбор терпимый: пропущенный `*** End Patch`, строки без
 * префикса (считаются контекстом) и пустые строки по краям ханка прощаются. Всё, что блоки карточек не
 * умеют (создание, удаление, переименование), — ошибка с подсказкой, что делать вместо этого.
 */

/** Ханк: какой фрагмент найти и на что заменить (контекстные строки входят в оба). */
export interface PatchHunk {
  old: string;
  new: string;
}

export interface PatchSection {
  path: string;
  hunks: PatchHunk[];
}

export type ParsePatchResult = { ok: true; sections: PatchSection[] } | { ok: false; error: string };

const BEGIN = "*** Begin Patch";
const END = "*** End Patch";
const UPDATE = "*** Update File:";

/** Строка ханка: вид и текст без префикса. bare — пустая строка без пробела-префикса (её срезаем по краям). */
interface HunkLine {
  kind: "context" | "remove" | "add";
  text: string;
  bare: boolean;
}

function toHunk(lines: HunkLine[]): PatchHunk | undefined {
  let start = 0;
  let end = lines.length;
  // Пустая строка перед следующей секцией или концом патча — разделитель, а не часть текста блока.
  while (start < end && lines[start]!.bare) start++;
  while (end > start && lines[end - 1]!.bare) end--;
  const body = lines.slice(start, end);
  if (!body.some((l) => l.kind !== "context")) return undefined;
  return {
    old: body.filter((l) => l.kind !== "add").map((l) => l.text).join("\n"),
    new: body.filter((l) => l.kind !== "remove").map((l) => l.text).join("\n"),
  };
}

function hunkLine(line: string): HunkLine {
  if (line === "") return { kind: "context", text: "", bare: true };
  const prefix = line[0];
  if (prefix === "-") return { kind: "remove", text: line.slice(1), bare: false };
  if (prefix === "+") return { kind: "add", text: line.slice(1), bare: false };
  if (prefix === " ") return { kind: "context", text: line.slice(1), bare: false };
  // Модель иногда забывает пробел у контекстной строки — считаем строку контекстом целиком.
  return { kind: "context", text: line, bare: false };
}

export function parsePatch(input: string): ParsePatchResult {
  const lines = input.replace(/\r\n?/g, "\n").split("\n");
  let i = 0;
  while (i < lines.length && lines[i]!.trim() === "") i++;
  if (lines[i]?.trim() !== BEGIN) return { ok: false, error: `the patch must start with "${BEGIN}"` };
  i++;

  const sections: PatchSection[] = [];
  let section: PatchSection | undefined;
  let hunk: HunkLine[] = [];
  const flushHunk = () => {
    const parsed = toHunk(hunk);
    if (parsed && section) section.hunks.push(parsed);
    hunk = [];
  };
  const flushSection = () => {
    flushHunk();
    if (section) sections.push(section);
    section = undefined;
  };

  for (; i < lines.length; i++) {
    const line = lines[i]!;
    const trimmed = line.trim();
    if (trimmed === END) break;
    if (trimmed.startsWith(UPDATE)) {
      flushSection();
      section = { path: trimmed.slice(UPDATE.length).trim(), hunks: [] };
      continue;
    }
    if (trimmed.startsWith("*** Add File:")) {
      return { ok: false, error: "blocks cannot be created — use the paths from get_cards; to fill an empty block use edit_block" };
    }
    if (trimmed.startsWith("*** Delete File:")) return { ok: false, error: "blocks cannot be deleted" };
    if (trimmed.startsWith("*** Move to:")) return { ok: false, error: "blocks cannot be renamed or moved" };
    if (trimmed === "*** End of File") continue;
    if (!section) {
      if (trimmed === "") continue;
      return { ok: false, error: `expected "${UPDATE} <path>" before the changes` };
    }
    if (line.startsWith("@@")) {
      flushHunk();
      continue;
    }
    hunk.push(hunkLine(line));
  }
  flushSection();

  if (sections.length === 0) return { ok: false, error: `the patch has no "${UPDATE}" sections` };
  const empty = sections.find((s) => s.hunks.length === 0);
  if (empty) return { ok: false, error: `no changes for ${empty.path} — use "-" and "+" lines` };
  return { ok: true, sections };
}

/** Пути секций в ещё стримящемся патче — только законченные строки (последняя может быть недописана). */
export function streamedPatchPaths(partial: string): string[] {
  const paths: string[] = [];
  for (const match of partial.replace(/\r\n?/g, "\n").matchAll(/^\*\*\* Update File:(.*)\n/gm)) {
    const path = match[1]!.trim();
    if (path && !paths.includes(path)) paths.push(path);
  }
  return paths;
}
