import { describe, expect, it } from "vitest";
import { runWithConcurrency } from "./concurrency.js";

describe("runWithConcurrency", () => {
  it("результаты в порядке входа, одновременно не больше concurrency", async () => {
    let active = 0;
    let peak = 0;
    const delays = [30, 5, 20, 1, 10];
    const result = await runWithConcurrency(delays, 2, async (ms) => {
      active++;
      peak = Math.max(peak, active);
      await new Promise((r) => setTimeout(r, ms));
      active--;
      return ms * 2;
    });
    expect(result).toEqual([60, 10, 40, 2, 20]);
    expect(peak).toBe(2);
  });

  it("пустой вход — пустой результат", async () => {
    await expect(runWithConcurrency([], 4, async (x) => x)).resolves.toEqual([]);
  });
});
