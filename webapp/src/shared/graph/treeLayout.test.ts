import { describe, expect, it } from "vitest";
import { NODE_H, NODE_W, layoutTreeNodes } from "./treeLayout";

// Шаги раскладки, выведенные из констант модуля (NODE_W=220,H_GAP=40 → HSTEP=260;
// NODE_H=80,V_GAP=100 → шаг по вертикали 180). Держим явными, чтобы тест ловил их изменение.
const HSTEP = NODE_W + 40;
const YSTEP = NODE_H + 100;

describe("layoutTreeNodes", () => {
  it("кладёт одиночный корень в начало координат", () => {
    const pos = layoutTreeNodes([{ id: 1, parentId: null }]);
    expect(pos.get(1)).toEqual({ x: 0, y: 0 });
  });

  it("линейная цепочка: каждый узел центрирован под родителем (x=0), y растёт по глубине", () => {
    const pos = layoutTreeNodes([
      { id: 1, parentId: null },
      { id: 2, parentId: 1 },
      { id: 3, parentId: 2 },
    ]);
    expect(pos.get(1)).toEqual({ x: 0, y: 0 });
    expect(pos.get(2)).toEqual({ x: 0, y: YSTEP });
    expect(pos.get(3)).toEqual({ x: 0, y: YSTEP * 2 });
  });

  it("родитель центрирован над двумя детьми, дети разнесены на HSTEP", () => {
    const pos = layoutTreeNodes([
      { id: 1, parentId: null },
      { id: 2, parentId: 1 },
      { id: 3, parentId: 1 },
    ]);
    expect(pos.get(1)!.x).toBe(0);
    // Дети симметричны относительно родителя и расходятся ровно на HSTEP.
    expect(pos.get(2)!.x).toBe(-HSTEP / 2);
    expect(pos.get(3)!.x).toBe(HSTEP / 2);
    expect(pos.get(2)!.y).toBe(YSTEP);
    expect(pos.get(3)!.y).toBe(YSTEP);
  });

  it("несколько корней пакуются слева направо без перекрытия", () => {
    const pos = layoutTreeNodes([
      { id: 1, parentId: null },
      { id: 2, parentId: null },
    ]);
    expect(pos.get(1)).toEqual({ x: 0, y: 0 });
    expect(pos.get(2)).toEqual({ x: HSTEP, y: 0 });
  });

  it("поддеревья-сиблинги не накладываются: внуки разных веток разнесены минимум на HSTEP", () => {
    // Корень с двумя детьми, у каждого по своему ребёнку — классический кейс, где наивная
    // раскладка (центр родителя = середина детей без учёта контуров) дала бы коллизию внуков.
    const pos = layoutTreeNodes([
      { id: 1, parentId: null },
      { id: 2, parentId: 1 },
      { id: 3, parentId: 1 },
      { id: 4, parentId: 2 },
      { id: 5, parentId: 3 },
    ]);
    const xs = [2, 3, 4, 5].map((id) => pos.get(id)!.x);
    // Все узлы одной глубины должны отстоять друг от друга не меньше чем на HSTEP.
    const depth1 = [pos.get(2)!.x, pos.get(3)!.x].sort((a, b) => a - b);
    const depth2 = [pos.get(4)!.x, pos.get(5)!.x].sort((a, b) => a - b);
    expect(depth1[1]! - depth1[0]!).toBeGreaterThanOrEqual(HSTEP);
    expect(depth2[1]! - depth2[0]!).toBeGreaterThanOrEqual(HSTEP);
    // Каждый узел получил позицию.
    expect(xs.every((x) => Number.isFinite(x))).toBe(true);
  });
});
