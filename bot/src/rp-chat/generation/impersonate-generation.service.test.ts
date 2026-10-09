import type { MessageEvent } from "@nestjs/common";
import type { Observable } from "rxjs";
import { describe, expect, it, vi } from "vitest";

vi.mock("../../logger.js", () => ({ default: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() } }));
vi.mock("../../db/index.js", () => ({ db: {}, schema: {} }));
const streamCompletion = vi.hoisted(() => vi.fn());
vi.mock("../../common/stream-completion.js", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  streamCompletion,
}));

const { ImpersonateGenerationService } = await import("./impersonate-generation.service.js");
type Args = ConstructorParameters<typeof ImpersonateGenerationService>;

function setup(userPersonaStreaming: boolean | undefined) {
  const ctx = {
    chat: { activeMessageId: 42, messages: [] },
    character: { name: "Рыцарь", prompt: "", scenario: "" },
    persona: null,
    template: userPersonaStreaming === undefined ? null : { userPersonaStreaming, userPersonaPrompt: "" },
    preset: null,
  };
  const access = { requireContext: vi.fn().mockResolvedValue(ctx) };
  const impersonations = { insert: vi.fn().mockResolvedValue({ id: 7, content: "Вариант" }) };
  const service = new ImpersonateGenerationService(access as unknown as Args[0], impersonations as unknown as Args[1]);
  return { service, impersonations };
}

const collect = (obs: Observable<MessageEvent>) =>
  new Promise<MessageEvent[]>((resolve) => {
    const events: MessageEvent[] = [];
    obs.subscribe({ next: (e) => events.push(e), complete: () => resolve(events) });
  });

describe("ImpersonateGenerationService", () => {
  it("вариант сохраняется для момента = курсора чата, done несёт { variant }", async () => {
    streamCompletion.mockResolvedValue({ content: "Вариант" });
    const { service, impersonations } = setup(true);
    const events = await collect(await service.generate(1, 5));
    expect(impersonations.insert).toHaveBeenCalledWith(1, 5, 42, "Вариант");
    expect(events).toEqual([{ type: "done", data: JSON.stringify({ variant: { id: 7, content: "Вариант" } }) }]);
  });

  it("стриминг токенов — по флагу шаблона; без шаблона — включён", async () => {
    streamCompletion.mockResolvedValue({ content: "x" });
    await collect(await setup(false).service.generate(1, 5));
    expect(streamCompletion.mock.lastCall?.[2]).toBe(false);
    await collect(await setup(undefined).service.generate(1, 5));
    expect(streamCompletion.mock.lastCall?.[2]).toBe(true);
  });
});
