export interface DiffSegment {
  type: "same" | "del" | "ins";
  text: string;
}

/** Выше этого числа ячеек таблица LCS слишком дорога для телефона — показываем замену целиком. */
const MAX_CELLS = 2_000_000;

/** Слова и пробелы отдельными токенами: пробелы сохраняются, переносы строк не теряются. */
function tokenize(text: string): string[] {
  return text.split(/(\s+)/).filter((t) => t.length > 0);
}

function push(segments: DiffSegment[], type: DiffSegment["type"], text: string) {
  const last = segments.at(-1);
  if (last?.type === type) last.text += text;
  else segments.push({ type, text });
}

/**
 * Пословный diff двух текстов блока (LCS). Пустой исходник — блок заполняется впервые: весь текст
 * вставка. Слишком длинные тексты — удаление целиком и вставка целиком, без подсветки внутри.
 */
export function wordDiff(before: string, after: string): DiffSegment[] {
  if (before === after) return before ? [{ type: "same", text: before }] : [];
  if (!before) return [{ type: "ins", text: after }];
  if (!after) return [{ type: "del", text: before }];

  const a = tokenize(before);
  const b = tokenize(after);
  if (a.length * b.length > MAX_CELLS) {
    return [
      { type: "del", text: before },
      { type: "ins", text: after },
    ];
  }

  // lcs[i][j] — длина общей подпоследовательности хвостов a[i..] и b[j..]; плоский массив ради памяти.
  const width = b.length + 1;
  const lcs = new Uint32Array((a.length + 1) * width);
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      lcs[i * width + j] = a[i] === b[j] ? lcs[(i + 1) * width + j + 1]! + 1 : Math.max(lcs[(i + 1) * width + j]!, lcs[i * width + j + 1]!);
    }
  }

  const segments: DiffSegment[] = [];
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      push(segments, "same", a[i]!);
      i++;
      j++;
    } else if (lcs[(i + 1) * width + j]! >= lcs[i * width + j + 1]!) {
      push(segments, "del", a[i++]!);
    } else {
      push(segments, "ins", b[j++]!);
    }
  }
  while (i < a.length) push(segments, "del", a[i++]!);
  while (j < b.length) push(segments, "ins", b[j++]!);
  return groupChanges(segments);
}

/**
 * LCS охотно совпадает по одиночным пробелам между заменёнными словами, и замена фразы рассыпается
 * на «del слово, пробел, ins слово, …». Склеиваем каждую цепочку изменений в одно удаление и одну
 * вставку: пробел, зажатый между изменениями, уходит в обе части.
 */
function groupChanges(segments: DiffSegment[]): DiffSegment[] {
  const result: DiffSegment[] = [];
  let del = "";
  let ins = "";
  const flush = () => {
    if (del) result.push({ type: "del", text: del });
    if (ins) result.push({ type: "ins", text: ins });
    del = "";
    ins = "";
  };
  segments.forEach((s, index) => {
    if (s.type === "del") del += s.text;
    else if (s.type === "ins") ins += s.text;
    else if ((del || ins) && /^\s+$/.test(s.text) && segments[index + 1] && segments[index + 1]!.type !== "same") {
      del += s.text;
      ins += s.text;
    } else {
      flush();
      push(result, "same", s.text);
    }
  });
  flush();
  return result;
}
