import { diffArrays } from "diff";

/**
 * Модель абзацев режима перевода: разбивка/склейка текста без потерь + двусторонняя синхронизация
 * двух буферов (оригинал/перевод) с сохранением нетронутых абзацев побайтово. Чистая логика без
 * I/O — сетевые вызовы и React-состояние живут в usePromptTranslate.ts.
 */

export interface TextSegment {
  content: string;
  /** Разделитель (2+ переноса строки, CRLF-safe) сразу после этого абзаца; "" — последний абзац. */
  separatorAfter: string;
}

// 2+ переноса строки — разбивка по пустой строке. Известное ограничение: плотный текст без пустых
// строк схлопнется в один блок; правка на построчную разбивку — смена этого разделителя на
// /((?:\r?\n)+)/, тем же lossless-приёмом (см. план).
const PARAGRAPH_SEPARATOR = /((?:\r?\n){2,})/;

/**
 * Lossless: joinSegments(splitIntoSegments(text)) === text для любого text — capturing-group split
 * возвращает контент/разделители строго чередующимися кусками исходной строки без потери символов.
 */
export function splitIntoSegments(text: string): TextSegment[] {
  if (text === "") return [];
  const parts = text.split(PARAGRAPH_SEPARATOR);
  const segments: TextSegment[] = [];
  for (let i = 0; i < parts.length; i += 2) {
    segments.push({ content: parts[i] ?? "", separatorAfter: parts[i + 1] ?? "" });
  }
  return segments;
}

export function joinSegments(segments: TextSegment[]): string {
  return segments.map((s) => s.content + s.separatorAfter).join("");
}

/**
 * Состояние одного абзаца режима перевода. Симметрично для обеих сторон: у каждой — текущее
 * значение и снэпшот на момент последней синхронизации (по нему определяется «грязно» ли).
 */
export interface TranslateBlock {
  id: string;
  source: string;
  sourceAtLastSync: string;
  translation: string;
  translationAtLastSync: string;
  separatorAfter: string;
}

export type BlockSide = "source" | "translation";

function createBlockId(): string {
  return crypto.randomUUID();
}

/** Зип 1:1 сегментов оригинала с уже смёрженным (см. mergeTranslated) полным массивом переводов —
 * та же длина/порядок, что у segments. Оба *AtLastSync выставляются равными текущим значениям —
 * состояние сразу считается синхронизированным. */
export function buildInitialBlocks(sourceText: string, translations: string[]): TranslateBlock[] {
  return splitIntoSegments(sourceText).map((seg, i) => {
    const translation = translations[i] ?? "";
    return {
      id: createBlockId(),
      source: seg.content,
      sourceAtLastSync: seg.content,
      translation,
      translationAtLastSync: translation,
      separatorAfter: seg.separatorAfter,
    };
  });
}

/**
 * Блоки для «Применить перевод как оригинал» — режим переводчика для нового текста: перевод уже
 * готов, повторный вызов переводчика не нужен, просто зеркалим текущий текст в обе стороны блока
 * (source = translation = text), чтобы обе AtLastSync сразу совпали с текущими значениями и синк
 * не считался нужным ни в одну сторону. См. usePromptTranslate.applyTranslation.
 */
export function buildIdentityBlocks(text: string): TranslateBlock[] {
  const segments = splitIntoSegments(text).map((s) => s.content);
  return buildInitialBlocks(text, segments);
}

export interface TranslatableSplit {
  /** Индексы непустых сегментов — то, что реально нужно отправить переводчику. */
  indices: number[];
  texts: string[];
}

/** Пустые/whitespace-абзацы не отправляются в перевод (падение googleTranslate("")/aiTranslate на
 * пустом тексте) — они переносятся как есть, без сетевого вызова, в обе стороны. */
export function splitTranslatable(segments: TextSegment[]): TranslatableSplit {
  const indices: number[] = [];
  const texts: string[] = [];
  segments.forEach((seg, i) => {
    if (seg.content.trim() !== "") {
      indices.push(i);
      texts.push(seg.content);
    }
  });
  return { indices, texts };
}

/** Восстанавливает полный (той же длины, что segments) массив переводов: непустые — из ответа
 * сервера (по индексам split), пустые — как есть (сами себя «переводят»). */
export function mergeTranslated(
  segments: TextSegment[],
  split: TranslatableSplit,
  translated: string[],
): string[] {
  const result = segments.map((seg) => seg.content);
  split.indices.forEach((segIndex, j) => {
    result[segIndex] = translated[j] ?? segments[segIndex]!.content;
  });
  return result;
}

/**
 * Реалайнмент после правок — не позиционное сравнение (ломается на сдвиге индексов при
 * вставке/удалении абзаца), а diffArrays (LCS-подобное выравнивание массивов, пакет `diff`) между
 * снэпшотом синхронизации указанной стороны и текущим текстом этой же стороны. Работает в обе
 * стороны одной функцией, параметризованной side.
 *
 * - Совпавшие (не added/removed) абзацы → чистые, id/противоположная сторона переносятся как есть
 *   (separatorAfter — из текущего сегмента, форматирование могло поменяться).
 * - Новые (added) → новый блок, редактируемая сторона = текущий текст, противоположная — пусто,
 *   AtLastSync редактируемой стороны — пусто (форсирует «грязно»).
 * - Удалённые (removed) абзацы старого массива — просто выпадают.
 */
export function realignBlocks(prevBlocks: TranslateBlock[], currentText: string, side: BlockSide): TranslateBlock[] {
  const currentSegments = splitIntoSegments(currentText);
  const prevContents = prevBlocks.map((b) => (side === "source" ? b.sourceAtLastSync : b.translationAtLastSync));
  const currentContents = currentSegments.map((s) => s.content);
  const changes = diffArrays(prevContents, currentContents);

  const result: TranslateBlock[] = [];
  let prevCursor = 0;
  let currentCursor = 0;

  for (const change of changes) {
    const count = change.value.length;
    if (change.added) {
      for (let k = 0; k < count; k++) {
        result.push(createBlankBlock(currentSegments[currentCursor]!, side));
        currentCursor++;
      }
    } else if (change.removed) {
      prevCursor += count;
    } else {
      for (let k = 0; k < count; k++) {
        const prevBlock = prevBlocks[prevCursor]!;
        const seg = currentSegments[currentCursor]!;
        result.push({ ...prevBlock, separatorAfter: seg.separatorAfter });
        prevCursor++;
        currentCursor++;
      }
    }
  }
  return result;
}

function createBlankBlock(seg: TextSegment, side: BlockSide): TranslateBlock {
  const base = {
    id: createBlockId(),
    source: "",
    sourceAtLastSync: "",
    translation: "",
    translationAtLastSync: "",
    separatorAfter: seg.separatorAfter,
  };
  return side === "source" ? { ...base, source: seg.content } : { ...base, translation: seg.content };
}

/** «Грязно» ли хоть что-то на указанной стороне — синк с ЭТОЙ стороны имеет смысл только пока
 * ПРОТИВОПОЛОЖНАЯ сторона чистая (иначе синк молча затрёт её несинхронизированные правки). */
export function hasDirty(blocks: TranslateBlock[], side: BlockSide): boolean {
  return blocks.some((b) => (side === "source" ? b.source !== b.sourceAtLastSync : b.translation !== b.translationAtLastSync));
}

export function dirtyIndices(blocks: TranslateBlock[], side: BlockSide): number[] {
  const out: number[] = [];
  blocks.forEach((b, i) => {
    const isDirty = side === "source" ? b.source !== b.sourceAtLastSync : b.translation !== b.translationAtLastSync;
    if (isDirty) out.push(i);
  });
  return out;
}

/**
 * Применяет результаты перевода грязных блоков указанной стороны на противоположную. Нетронутые
 * блоки остаются той же ссылкой (shallow copy массива) — побайтовая сохранность гарантирована самой
 * структурой функции, а не отдельной сверкой. side — сторона-ИСТОЧНИК (её текущее значение уже верно,
 * counterpart обновляется результатом перевода), например side="source" ⇒ обновляем translation.
 */
export function applySyncResults(
  blocks: TranslateBlock[],
  side: BlockSide,
  dirty: number[],
  translated: string[],
): TranslateBlock[] {
  const result = blocks.slice();
  dirty.forEach((blockIndex, j) => {
    const block = result[blockIndex]!;
    const newText = translated[j] ?? "";
    result[blockIndex] =
      side === "source"
        ? { ...block, translation: newText, translationAtLastSync: newText, sourceAtLastSync: block.source }
        : { ...block, source: newText, sourceAtLastSync: newText, translationAtLastSync: block.translation };
  });
  return result;
}

export function joinSource(blocks: TranslateBlock[]): string {
  return blocks.map((b) => b.source + b.separatorAfter).join("");
}

export function joinTranslation(blocks: TranslateBlock[]): string {
  return blocks.map((b) => b.translation + b.separatorAfter).join("");
}
