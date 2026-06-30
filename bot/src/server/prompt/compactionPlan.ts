/**
 * Чистая логика сегментации сжатия (compact) — без I/O, тестируется юнит-тестом (как trimHistoryToBudget).
 * Решает, какие сообщения живого хвоста уходят в пересказы и как они режутся на сегменты.
 */

/** Элемент живого хвоста для планирования: бит ли это и его стоимость в токенах (с надбавкой). */
export type CompactionTailItem = { isBeat: boolean; tokens: number };

/** Минимум полей пересказа для выбора валидной цепочки. */
export type ChainLink = { fromAnchorId: number | null; toAnchorId: number };

/**
 * Выбирает валидную цепочку-префикс пересказов для активной ветки. Сначала отбрасываем пересказы, чьи
 * якоря НЕ на активном пути (ветка разошлась — они принадлежат другой ветке), затем из оставшихся
 * (в порядке seq) берём непрерывный префикс от корня: c0.from=null, каждый следующий from = to
 * предыдущего. Останавливаемся на первом разрыве сцепки.
 *
 * Важно: фильтр-ПОТОМ-обход (а не обход-с-break) — иначе пересказ другой ветки в середине seq оборвал
 * бы цепочку и спрятал валидные более поздние пересказы текущей ветки (→ ветка не сжимается никогда).
 *
 * @param compactions Пересказы истории в порядке seq (возрастание).
 * @param pathIds     Множество id сообщений активного пути.
 */
export function selectValidChain<T extends ChainLink>(compactions: T[], pathIds: Set<number>): T[] {
  const onPath = compactions.filter(
    (c) => pathIds.has(c.toAnchorId) && (c.fromAnchorId === null || pathIds.has(c.fromAnchorId)),
  );
  const chain: T[] = [];
  let expectedFrom: number | null = null;
  for (const c of onPath) {
    if (c.fromAnchorId !== expectedFrom) break; // настоящий разрыв сцепки → цепочка кончилась
    chain.push(c);
    expectedFrom = c.toAnchorId;
  }
  return chain;
}

/**
 * Планирует сегменты сжатия. Возвращает массив сегментов; каждый сегмент — массив индексов в `tail`
 * (по порядку), последний индекс сегмента — всегда бит (якорь `toAnchorId`). Пустой массив = сжимать
 * нечего (история уже ≤ floor, или нет подходящего бита-якоря).
 *
 * @param tail        Живой хвост активной ветки (ещё не сжатые сообщения), хронологически. Последний
 *                    элемент — текущий лист/живой триггер, его НИКОГДА не сжимаем (якорь < lastIndex).
 * @param overhead    Always-present стоимость запроса в токенах (system-блоки + существующие пересказы
 *                    + leading-user). Вместе с суммой хвоста даёт «всего вход».
 * @param floor       Целевой «пол» — до скольких токенов общего входа сжимаем.
 * @param segment     Размер сегмента S (контекст − floor): сколько токенов копим в один пересказ.
 */
export function planCompactionSegments(
  tail: CompactionTailItem[],
  overhead: number,
  floor: number,
  segment: number,
): number[][] {
  const lastIndex = tail.length - 1;
  // Кандидаты-якоря: биты строго до последнего элемента (лист/триггер не трогаем).
  const beatIndices: number[] = [];
  for (let i = 0; i < lastIndex; i++) if (tail[i]!.isBeat) beatIndices.push(i);
  if (beatIndices.length === 0) return [];

  const total = overhead + tail.reduce((s, m) => s + m.tokens, 0);
  if (total <= floor) return [];

  // Сколько токенов хвоста оставляем живыми, чтобы общий вход уложился в floor.
  const targetRemainder = floor - overhead;

  // Префиксные суммы для быстрого подсчёта остатка [k+1..].
  const suffixFrom = (k: number): number => {
    let s = 0;
    for (let i = k + 1; i <= lastIndex; i++) s += tail[i]!.tokens;
    return s;
  };

  // Минимальное сжатие: наименьший бит-якорь k, при котором остаток ≤ targetRemainder. Если ни один
  // не подходит (overhead уже ≥ floor) — берём самый поздний допустимый бит (сжимаем максимум).
  let cut = beatIndices[beatIndices.length - 1]!;
  for (const k of beatIndices) {
    if (suffixFrom(k) <= targetRemainder) {
      cut = k;
      break;
    }
  }

  // Режем префикс [0..cut] на сегменты по ~segment токенов; каждый сегмент закрывается на бите.
  const segments: number[][] = [];
  let current: number[] = [];
  let acc = 0;
  for (let i = 0; i <= cut; i++) {
    current.push(i);
    acc += tail[i]!.tokens;
    if (acc >= segment && tail[i]!.isBeat && i < cut) {
      segments.push(current);
      current = [];
      acc = 0;
    }
  }
  if (current.length > 0) segments.push(current); // финальный сегмент заканчивается на cut (бит)
  return segments;
}
