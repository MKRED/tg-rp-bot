import { beforeEach, describe, expect, it, vi } from "vitest";

const chatCompletion = vi.fn();
vi.mock("../llm/client.js", () => ({ chatCompletion }));

const { MissingApiKeyError } = await import("../llm/errors.js");
const { streamCompletion, writeGenerationError } = await import("./stream-completion.js");

function sink() {
  const events: { event: string; data: string }[] = [];
  return { events, writeSSE: vi.fn(async (m: { event: string; data: string }) => void events.push(m)) };
}

const OPTIONS = { messages: [], userId: 1 };

describe("streamCompletion", () => {
  beforeEach(() => {
    chatCompletion.mockReset();
  });

  it("токены и reset уходят в поток событиями token/reset", async () => {
    chatCompletion.mockImplementation(async (_o, onChunk: (t: string) => void, onReset: () => void) => {
      onChunk("При");
      onReset();
      onChunk("вет");
      return { content: "вет" };
    });
    const s = sink();
    await expect(streamCompletion(s, OPTIONS)).resolves.toEqual({ content: "вет" });
    expect(s.events).toEqual([
      { event: "token", data: '{"text":"При"}' },
      { event: "reset", data: "{}" },
      { event: "token", data: '{"text":"вет"}' },
    ]);
  });

  it("doStream=false — без callback'ов, поток молчит до done", async () => {
    chatCompletion.mockResolvedValue({ content: "x" });
    const s = sink();
    await streamCompletion(s, OPTIONS, false);
    expect(chatCompletion).toHaveBeenCalledWith(OPTIONS, undefined, undefined);
    expect(s.events).toEqual([]);
  });

  it("сбой записи (клиент ушёл) не роняет генерацию", async () => {
    chatCompletion.mockImplementation(async (_o, onChunk: (t: string) => void) => {
      onChunk("a");
      return { content: "a" };
    });
    const s = { writeSSE: vi.fn().mockRejectedValue(new Error("closed")) };
    await expect(streamCompletion(s, OPTIONS)).resolves.toEqual({ content: "a" });
  });
});

describe("writeGenerationError", () => {
  it("нет ключа — текст ошибки как есть; прочее — общий текст", async () => {
    const s = sink();
    await writeGenerationError(s, new MissingApiKeyError());
    await writeGenerationError(s, new Error("boom"));
    expect(s.events.map((e) => e.event)).toEqual(["error", "error"]);
    expect(JSON.parse(s.events[0].data).message).toBe(new MissingApiKeyError().message);
    expect(JSON.parse(s.events[1].data).message).toBe("Не удалось сгенерировать ответ. Попробуйте ещё раз.");
  });
});
