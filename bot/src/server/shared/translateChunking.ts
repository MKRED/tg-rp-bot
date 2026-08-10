/**
 * Lossless-чанкинг ОДНОГО блока текста, слишком длинного для одного вызова переводчика
 * (googleTranslate кладёт текст в GET query string — длинный текст падает/обрезается).
 * Инвариант: joinChunks(chunkText(text, max)) === text для любого text/max — чанки это просто
 * последовательные подстроки исходного текста, конкатенация без потерь по построению.
 *
 * Порядок деления: перенос строки → предложение → жёсткая нарезка по длине (гарантированно
 * завершающийся fallback, если в куске вообще нет ни переносов, ни знаков препинания).
 */

function splitPreserving(text: string, separator: RegExp): string[] {
  return text.split(separator).filter((piece) => piece !== undefined && piece !== "");
}

/** Жадно группирует куски в чанки не длиннее maxChars; кусок длиннее maxChars идёт отдельным
 * (ещё не разбитым) чанком — вызывающий код разбивает его дальше более тонким разделителем. */
function packPieces(pieces: string[], maxChars: number): string[] {
  const chunks: string[] = [];
  let current = "";
  for (const piece of pieces) {
    if (current && current.length + piece.length > maxChars) {
      chunks.push(current);
      current = "";
    }
    if (piece.length > maxChars) {
      if (current) {
        chunks.push(current);
        current = "";
      }
      chunks.push(piece);
      continue;
    }
    current += piece;
  }
  if (current) chunks.push(current);
  return chunks;
}

function hardSlice(text: string, maxChars: number): string[] {
  const out: string[] = [];
  for (let i = 0; i < text.length; i += maxChars) out.push(text.slice(i, i + maxChars));
  return out;
}

export function chunkText(text: string, maxChars: number): string[] {
  if (text.length <= maxChars) return [text];

  let chunks = packPieces(splitPreserving(text, /(\r?\n)/), maxChars);
  chunks = chunks.flatMap((chunk) =>
    chunk.length <= maxChars ? [chunk] : packPieces(splitPreserving(chunk, /([.!?]\s+)/), maxChars),
  );
  chunks = chunks.flatMap((chunk) => (chunk.length <= maxChars ? [chunk] : hardSlice(chunk, maxChars)));
  return chunks;
}

export function joinChunks(chunks: string[]): string {
  return chunks.join("");
}
