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

/**
 * Отделяет крайние пробельные символы (пробелы/переносы строк) чанка от смыслового текста.
 * chunkText режет в первую очередь по переносам строк (см. комментарий выше) — сам разделитель
 * между соседними чанками физически оказывается на границе, хвостом одного чанка или началом
 * другого. aiTranslate триммит ответ модели (translate.ts) — если отдать этот пробельный хвост/
 * голову переводчику, он их молча съест, и joinChunks("") склеит переведённые чанки без
 * разделителя (абзацы слипнутся). Поэтому граница никогда не идёт в translateOne — переводим
 * только "ядро", а пробелы возвращаем на место буквально, независимо от того, что вернул перевод.
 */
function splitEdgeWhitespace(text: string): { leading: string; core: string; trailing: string } {
  const leading = text.match(/^\s*/)![0];
  const rest = text.slice(leading.length);
  const trailing = rest.match(/\s*$/)![0];
  const core = rest.slice(0, rest.length - trailing.length);
  return { leading, core, trailing };
}

async function translateChunkCore(
  chunk: string,
  translateOne: (chunk: string) => Promise<string>,
): Promise<string> {
  const { leading, core, trailing } = splitEdgeWhitespace(chunk);
  if (core === "") return chunk;
  return leading + (await translateOne(core)) + trailing;
}

/**
 * Переводит один текстовый блок (абзац или целый текст) через переданную функцию перевода,
 * прозрачно чанкуя его, если он длиннее maxChars, и склеивая результат обратно. Пустые/whitespace
 * блоки — без сетевого вызова (переносятся как есть), т.к. googleTranslate/aiTranslate падают на
 * пустом тексте. Каждый чанк переводится через translateChunkCore — граничные пробелы/переносы
 * сохраняются буквально, а не полагаются на то, что translateOne их не тронет (см. splitEdgeWhitespace).
 */
export async function translateChunked(
  text: string,
  maxChars: number,
  translateOne: (chunk: string) => Promise<string>,
): Promise<string> {
  if (text.trim() === "") return text;
  if (text.length <= maxChars) return translateChunkCore(text, translateOne);
  const chunks = chunkText(text, maxChars);
  const translatedChunks: string[] = [];
  for (const chunk of chunks) translatedChunks.push(await translateChunkCore(chunk, translateOne));
  return joinChunks(translatedChunks);
}
