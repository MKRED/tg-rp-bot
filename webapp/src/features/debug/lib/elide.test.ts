import { describe, expect, it } from "vitest";
import { elideRequest, isElidedMarker } from "./elide";

const msgs = (n: number) =>
  Array.from({ length: n }, (_, i) => ({ role: "user", content: `m${i}` }));

describe("elideRequest", () => {
  it("оставляет request без изменений, если messages короче head+tail", () => {
    const req = { model: "x", messages: msgs(4) };
    expect(elideRequest(req, 3, 5)).toBe(req); // та же ссылка — целиком
  });

  it("схлопывает середину, сохраняя края", () => {
    const req = { model: "x", messages: msgs(10) };
    const out = elideRequest(req, 2, 3);
    const out_msgs = out.messages as unknown[];
    // 2 головы + маркер + 3 хвоста = 6 элементов
    expect(out_msgs).toHaveLength(6);
    expect((out_msgs[0] as { content: string }).content).toBe("m0");
    expect((out_msgs[5] as { content: string }).content).toBe("m9");
    expect(isElidedMarker(out_msgs[2])).toBe(true);
    expect((out_msgs[2] as { _elided: string })._elided).toContain("5"); // 10-2-3=5 пропущено
  });

  it("не падает, если messages отсутствует", () => {
    const req = { model: "x" };
    expect(elideRequest(req, 2, 2)).toBe(req);
  });

  it("отрицательные K трактует как 0", () => {
    const req = { messages: msgs(5) };
    const out = elideRequest(req, -1, -1);
    // head=0, tail=0 → весь массив «пропущен», только маркер
    expect(out.messages).toHaveLength(1);
    expect(isElidedMarker((out.messages as unknown[])[0])).toBe(true);
  });
});
