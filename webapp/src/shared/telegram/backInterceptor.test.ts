import { describe, expect, it, vi } from "vitest";
import { consumeBackInterceptor, pushBackInterceptor } from "./backInterceptor";

describe("backInterceptor", () => {
  it("без перехватчиков не съедает нажатие", () => {
    expect(consumeBackInterceptor()).toBe(false);
  });

  it("вызывает верхний перехватчик и съедает нажатие", () => {
    const handler = vi.fn();
    const remove = pushBackInterceptor(handler);
    expect(consumeBackInterceptor()).toBe(true);
    expect(handler).toHaveBeenCalledTimes(1);
    remove();
  });

  it("вложенность: вызывает только верхний (последний добавленный)", () => {
    const outer = vi.fn();
    const inner = vi.fn();
    const removeOuter = pushBackInterceptor(outer);
    const removeInner = pushBackInterceptor(inner);

    consumeBackInterceptor();
    expect(inner).toHaveBeenCalledTimes(1);
    expect(outer).not.toHaveBeenCalled();

    removeInner();
    consumeBackInterceptor();
    expect(outer).toHaveBeenCalledTimes(1);

    removeOuter();
  });

  it("снятие перехватчика убирает его из стека", () => {
    const handler = vi.fn();
    const remove = pushBackInterceptor(handler);
    remove();
    expect(consumeBackInterceptor()).toBe(false);
    expect(handler).not.toHaveBeenCalled();
  });
});
