import { describe, expect, it, vi } from "vitest";
import { buildImpersonateCompletion, buildRpCompletion } from "./rp-completion.js";

const base = {
  chat: { messages: [{ id: 1, parentId: null, role: "assistant", content: "Стой, путник.", translations: null, createdAt: "", siblingIndex: 0, siblingCount: 1, siblings: [1] }] },
  character: { name: "Рыцарь", prompt: "Рыцарь {{user}}", scenario: "" },
  persona: { name: "Путник", prompt: "Странник" },
  template: null,
  preset: null,
} as unknown as Parameters<typeof buildRpCompletion>[0];

describe("buildRpCompletion", () => {
  it("без шаблона и пресета — дефолтный порядок, пустой сэмплинг; реплика игрока последней", () => {
    const { messages, sampling } = buildRpCompletion(base, "Кто ты?");
    expect(sampling).toEqual({});
    expect(messages.at(-1)).toEqual({ role: "user", content: "Кто ты?" });
    expect(messages.filter((m) => m.role === "user")).toHaveLength(1);
    expect(messages.some((m) => m.content.includes("Рыцарь Путник"))).toBe(true);
  });

  it("сэмплинг — из пресета, onTrim вызывается при урезании истории под окно", () => {
    const onTrim = vi.fn();
    const long = Array.from({ length: 40 }, (_, i) => ({ ...base.chat.messages[0], id: i + 1, content: "слово ".repeat(50) }));
    const ctx = {
      ...base,
      chat: { messages: long },
      preset: { temperature: 0.7, maxTokens: 50, contextUnlimited: false, contextSize: 400 },
    } as unknown as Parameters<typeof buildRpCompletion>[0];
    const { sampling } = buildRpCompletion(ctx, "Дальше", onTrim);
    expect(sampling).toMatchObject({ temperature: 0.7, maxTokens: 50 });
    expect(onTrim).toHaveBeenCalled();
  });
});

describe("buildImpersonateCompletion", () => {
  it("стриминг по умолчанию включён; флаг шаблона его выключает", () => {
    expect(buildImpersonateCompletion(base).doStream).toBe(true);
    const ctx = { ...base, template: { userPersonaStreaming: false, userPersonaPrompt: "", systemPrompt: "", auxiliarySystemPrompt: "" } };
    expect(buildImpersonateCompletion(ctx as unknown as typeof base).doStream).toBe(false);
  });

  it("два сообщения: system-шаблон и плоская история", () => {
    const { messages, sampling } = buildImpersonateCompletion(base);
    expect(messages.map((m) => m.role)).toEqual(["system", "user"]);
    expect(sampling).toEqual({});
  });
});
