import { HttpException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import { hashAgentToken } from "./agent-token.js";
import type { ComfyAgentRepository } from "./comfy-agent.repository.js";
import { ComfyAgentService } from "./comfy-agent.service.js";
import { InstallCodes } from "./install/index.js";
import { RelayHub } from "./relay/index.js";

vi.mock("../logger.js", () => ({
  default: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

function setup() {
  const hashes = new Map<string, string>();
  const repository = {
    hasToken: vi.fn(async (userId: string) => hashes.has(userId)),
    findUserIdByTokenHash: vi.fn(async (hash: string) => [...hashes].find(([, h]) => h === hash)?.[0] ?? null),
    setTokenHash: vi.fn(async (userId: string, hash: string | null) => {
      if (hash) hashes.set(userId, hash);
      else hashes.delete(userId);
    }),
  } as unknown as ComfyAgentRepository;
  const hub = new RelayHub({ pollHoldMs: 50, onlineWindowMs: 1000, jobTimeoutMs: 200 });
  const service = new ComfyAgentService(repository, hub, new InstallCodes(60_000));
  /** Установка агента как её делает команда: код → токен. */
  const install = async (userId: string) => (await service.redeemInstallCode(service.issueInstallCode(userId).code))!;
  return { service, hashes, hub, install };
}

async function errorBody(promise: Promise<unknown>) {
  const err = await promise.catch((e: unknown) => e);
  expect(err).toBeInstanceOf(HttpException);
  return { status: (err as HttpException).getStatus(), body: (err as HttpException).getResponse() };
}

describe("ComfyAgentService", () => {
  it("код установки меняется на токен, в БД только хеш, агент входит по токену", async () => {
    const { service, hashes, install } = setup();
    const token = await install("u1");
    expect(token.startsWith("cagt_")).toBe(true);
    expect(hashes.get("u1")).toBe(hashAgentToken(token));
    await expect(service.authenticateAgent(`Bearer ${token}`)).resolves.toBe("u1");
  });

  it("код одноразовый; выдача кода не трогает текущий токен", async () => {
    const { service, hashes, install } = setup();
    const token = await install("u1");
    const { code } = service.issueInstallCode("u1");
    expect(hashes.get("u1")).toBe(hashAgentToken(token));
    expect(await service.redeemInstallCode(code)).not.toBeNull();
    expect(await service.redeemInstallCode(code)).toBeNull();
  });

  it("после переустановки старый токен не работает", async () => {
    const { service, install } = setup();
    const old = await install("u1");
    await install("u1");
    expect((await errorBody(service.authenticateAgent(`Bearer ${old}`))).status).toBe(401);
  });

  it("без агента — 503 comfy_agent_offline", async () => {
    const { service } = setup();
    const { status, body } = await errorBody(service.systemStats("u1"));
    expect(status).toBe(503);
    expect(body).toMatchObject({ error: "comfy_agent_offline" });
  });

  it("цепочка: агент забирает задание, ответ разбирается как JSON", async () => {
    const { service } = setup();
    const poll = service.poll("u1", new AbortController().signal);
    const stats = service.systemStats("u1");
    const [job] = await poll;
    expect(job).toMatchObject({ method: "GET", path: "/api/system_stats" });
    const body = Buffer.from(JSON.stringify({ system: { comfyui_version: "0.44.0" } })).toString("base64");
    expect(service.complete("u1", job.id, { status: 200, contentType: "application/json", bodyBase64: body })).toEqual({ ok: true });
    await expect(stats).resolves.toEqual({ system: { comfyui_version: "0.44.0" } });
  });

  it("агент не достучался до ComfyUI — 502 comfy_unreachable", async () => {
    const { service } = setup();
    const poll = service.poll("u1", new AbortController().signal);
    const stats = service.systemStats("u1");
    const [job] = await poll;
    service.complete("u1", job.id, { status: 0, contentType: null, bodyBase64: "", error: "connection refused" });
    const { status, body } = await errorBody(stats);
    expect(status).toBe(502);
    expect(body).toMatchObject({ error: "comfy_unreachable" });
  });

  it("запрос вне белого списка не уходит агенту", async () => {
    const { service } = setup();
    await expect(service.callComfy("u1", { method: "GET", path: "/api/userdata/x" })).rejects.toThrow("not allowed");
  });

  it("отзыв токена отключает агента", async () => {
    const { service, install } = setup();
    await install("u1");
    const poll = service.poll("u1", new AbortController().signal);
    await service.revokeToken("u1");
    await expect(poll).resolves.toEqual([]);
    expect(await service.status("u1")).toMatchObject({ hasToken: false, online: false });
  });
});

describe("ComfyAgentService: тело запроса", () => {
  it("JSON-тело уходит агенту байтами в base64 без потери больших чисел", async () => {
    const { service } = setup();
    const poll = service.poll("u1", new AbortController().signal);
    const call = service.callComfy("u1", { method: "POST", path: "/api/prompt", json: { prompt: { "1": { inputs: { seed: 891836227295375 } } } } });
    const [job] = await poll;
    expect(job.contentType).toBe("application/json");
    expect(Buffer.from(job.bodyBase64!, "base64").toString("utf8")).toBe('{"prompt":{"1":{"inputs":{"seed":891836227295375}}}}');
    service.complete("u1", job.id, { status: 200, contentType: "application/json", bodyBase64: "e30=" });
    await expect(call).resolves.toMatchObject({ status: 200 });
  });
});
