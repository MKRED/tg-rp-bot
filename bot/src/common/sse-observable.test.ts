import type { MessageEvent } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";

const logger = vi.hoisted(() => ({ warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() }));
vi.mock("../logger.js", () => ({ default: logger }));

const { sseObservable } = await import("./sse-observable.js");

function collect(obs: ReturnType<typeof sseObservable>) {
  return new Promise<{ events: MessageEvent[]; error?: unknown }>((resolve) => {
    const events: MessageEvent[] = [];
    obs.subscribe({ next: (e) => events.push(e), complete: () => resolve({ events }), error: (error) => resolve({ events, error }) });
  });
}

describe("sseObservable", () => {
  it("события из sink уходят как MessageEvent, поток закрывается по завершении run", async () => {
    const obs = sseObservable("t", async (sink) => {
      await sink.writeSSE({ event: "token", data: '{"text":"a"}' });
      await sink.writeSSE({ event: "done", data: "{}" });
    });
    expect(await collect(obs)).toEqual({
      events: [
        { type: "token", data: '{"text":"a"}' },
        { type: "done", data: "{}" },
      ],
    });
  });

  it("run не стартует до подписки", () => {
    const run = vi.fn().mockResolvedValue(undefined);
    const obs = sseObservable("t", run);
    expect(run).not.toHaveBeenCalled();
    obs.subscribe();
    expect(run).toHaveBeenCalledTimes(1);
  });

  it("непредвиденный сбой run — лог и обычное завершение, без error в потоке", async () => {
    const result = await collect(sseObservable("t", () => Promise.reject(new Error("boom"))));
    expect(result).toEqual({ events: [] });
    expect(logger.error).toHaveBeenCalled();
  });

  it("отписка не прерывает run: генерация доходит до конца", async () => {
    let finished = false;
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const sub = sseObservable("t", async (sink) => {
      await gate;
      await sink.writeSSE({ event: "done", data: "{}" });
      finished = true;
    }).subscribe();
    sub.unsubscribe();
    release();
    await new Promise((r) => setTimeout(r, 0));
    expect(finished).toBe(true);
  });
});
