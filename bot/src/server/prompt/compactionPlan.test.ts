import { describe, expect, it } from "vitest";
import {
  type ChainLink,
  type CompactionTailItem,
  planCompactionSegments,
  selectValidChain,
} from "./compactionPlan.js";

describe("selectValidChain", () => {
  const c = (from: number | null, to: number): ChainLink => ({ fromAnchorId: from, toAnchorId: to });

  it("линейная цепочка целиком на пути — берём всю", () => {
    const all = [c(null, 10), c(10, 20), c(20, 30)];
    const path = new Set([10, 20, 30, 40]);
    expect(selectValidChain(all, path)).toEqual(all);
  });

  it("расхождение ветки: пересказ другой ветки в середине seq не обрывает валидные поздние", () => {
    // seq0: root→a0(10); seq1: a0→a1(20) на ветке A; seq2: a0→b(99) на ветке B.
    // Активный путь — ветка B (проходит через a0 и b, но не a1).
    const all = [c(null, 10), c(10, 20), c(10, 99)];
    const pathB = new Set([10, 99, 100]);
    expect(selectValidChain(all, pathB)).toEqual([c(null, 10), c(10, 99)]);
    // А на ветке A — своя цепочка, разделяя префикс seq0.
    const pathA = new Set([10, 20, 30]);
    expect(selectValidChain(all, pathA)).toEqual([c(null, 10), c(10, 20)]);
  });

  it("разрыв сцепки (нет звена от корня) → пусто", () => {
    const all = [c(10, 20)]; // нет c(null, …)
    expect(selectValidChain(all, new Set([10, 20]))).toEqual([]);
  });

  it("пустой вход → пусто", () => {
    expect(selectValidChain([], new Set([1, 2]))).toEqual([]);
  });
});

/** Хелпер: строит хвост из чередующихся бит/директива по заданным токенам бита. */
function tail(beatsTokens: number[], opts: { trailingTrigger?: boolean } = {}): CompactionTailItem[] {
  // Чередование beat, user, beat, user, ... Директивы дешёвые (нейтрализуются).
  const items: CompactionTailItem[] = [];
  beatsTokens.forEach((bt, i) => {
    items.push({ isBeat: true, tokens: bt });
    if (i < beatsTokens.length - 1 || opts.trailingTrigger) {
      items.push({ isBeat: false, tokens: 5 });
    }
  });
  return items;
}

describe("planCompactionSegments", () => {
  it("история уже ≤ floor → пусто (no-op)", () => {
    const t = tail([100, 100, 100]);
    expect(planCompactionSegments(t, 50, 5000, 1000)).toEqual([]);
  });

  it("нет бита-якоря до листа → пусто", () => {
    // Один бит = лист, сжимать нечего.
    const t: CompactionTailItem[] = [{ isBeat: true, tokens: 10000 }];
    expect(planCompactionSegments(t, 0, 1000, 500)).toEqual([]);
  });

  it("устойчивый режим: один сегмент, якорь — бит, лист не трогаем", () => {
    // 4 бита по 5000 + дешёвые директивы; floor мал → сжать старейшее, сегмент большой → один пересказ.
    const t = tail([5000, 5000, 5000, 5000]);
    const segs = planCompactionSegments(t, 0, 6000, 100000);
    expect(segs.length).toBe(1);
    // Последний индекс сегмента — бит и строго до последнего элемента (лист защищён).
    const last = segs[0]![segs[0]!.length - 1]!;
    expect(t[last]!.isBeat).toBe(true);
    expect(last).toBeLessThan(t.length - 1);
  });

  it("большой бэклог: несколько сегментов по ~S, каждый кончается битом", () => {
    // 6 бит по 5000. floor низкий → сжать почти всё; segment 5000 → ~1 бит на сегмент.
    const t = tail([5000, 5000, 5000, 5000, 5000, 5000]);
    const segs = planCompactionSegments(t, 0, 3000, 5000);
    expect(segs.length).toBeGreaterThan(1);
    for (const seg of segs) {
      const anchor = seg[seg.length - 1]!;
      expect(t[anchor]!.isBeat).toBe(true);
    }
    // Все индексы покрыты без дыр и по возрастанию.
    const flat = segs.flat();
    expect(flat).toEqual([...flat].sort((a, b) => a - b));
  });

  it("overhead ≥ floor → сжимаем максимум (до последнего допустимого бита)", () => {
    const t = tail([3000, 3000, 3000]);
    const segs = planCompactionSegments(t, 10000, 5000, 100000);
    expect(segs.length).toBe(1);
    const anchor = segs[0]![segs[0]!.length - 1]!;
    // Самый поздний бит до листа.
    expect(t[anchor]!.isBeat).toBe(true);
    expect(anchor).toBeLessThan(t.length - 1);
  });
});
