import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AgentOfflineError, AgentTimeoutError, RelayHub } from "./relay-hub.js";

const OK = { status: 200, contentType: "application/json", bodyBase64: "e30=" };

describe("RelayHub", () => {
  let hub: RelayHub;
  beforeEach(() => {
    vi.useFakeTimers();
    hub = new RelayHub({ pollHoldMs: 25_000, onlineWindowMs: 40_000, jobTimeoutMs: 10_000 });
  });
  afterEach(() => vi.useRealTimers());

  it("без агента запрос сразу падает как офлайн", async () => {
    expect(hub.isOnline("u1")).toBe(false);
    await expect(hub.request("u1", { method: "GET", path: "/api/system_stats" })).rejects.toBeInstanceOf(AgentOfflineError);
  });

  it("задание уходит ждущему poll, ответ возвращается запросившему", async () => {
    const poll = hub.poll("u1");
    const req = hub.request("u1", { method: "GET", path: "/api/system_stats" });
    const jobs = await poll;
    expect(jobs).toHaveLength(1);
    expect(jobs[0].path).toBe("/api/system_stats");
    expect(hub.complete("u1", jobs[0].id, OK)).toBe(true);
    await expect(req).resolves.toEqual(OK);
  });

  it("задание, пришедшее между poll'ами, отдаётся следующим poll сразу", async () => {
    await vi.advanceTimersByTimeAsync(0);
    const first = hub.poll("u1");
    await vi.advanceTimersByTimeAsync(25_000);
    await expect(first).resolves.toEqual([]);
    const req = hub.request("u1", { method: "GET", path: "/api/queue" });
    const jobs = await hub.poll("u1");
    expect(jobs).toHaveLength(1);
    hub.complete("u1", jobs[0].id, OK);
    await expect(req).resolves.toEqual(OK);
  });

  it("агент без связи дольше окна считается офлайн", async () => {
    const poll = hub.poll("u1");
    await vi.advanceTimersByTimeAsync(25_000);
    await poll;
    expect(hub.isOnline("u1")).toBe(true);
    await vi.advanceTimersByTimeAsync(40_001);
    expect(hub.isOnline("u1")).toBe(false);
  });

  it("без ответа — таймаут, задание убирается из очереди", async () => {
    const poll = hub.poll("u1");
    await vi.advanceTimersByTimeAsync(25_000);
    await poll;
    const req = hub.request("u1", { method: "GET", path: "/api/queue" });
    const caught = req.catch((e: unknown) => e);
    await vi.advanceTimersByTimeAsync(10_000);
    expect(await caught).toBeInstanceOf(AgentTimeoutError);
    const next = hub.poll("u1");
    await vi.advanceTimersByTimeAsync(25_000);
    await expect(next).resolves.toEqual([]);
  });

  it("чужой пользователь не может ответить на задание", async () => {
    const poll = hub.poll("u1");
    const req = hub.request("u1", { method: "GET", path: "/api/queue" });
    const [job] = await poll;
    expect(hub.complete("u2", job.id, OK)).toBe(false);
    hub.complete("u1", job.id, OK);
    await expect(req).resolves.toEqual(OK);
  });

  it("оборванный poll не забирает задания", async () => {
    const ctrl = new AbortController();
    const dead = hub.poll("u1", ctrl.signal);
    ctrl.abort();
    await expect(dead).resolves.toEqual([]);
    const req = hub.request("u1", { method: "GET", path: "/api/queue" });
    const jobs = await hub.poll("u1");
    expect(jobs).toHaveLength(1);
    hub.complete("u1", jobs[0].id, OK);
    await expect(req).resolves.toEqual(OK);
  });

  it("новый poll отпускает прежний пустым", async () => {
    const old = hub.poll("u1");
    void hub.poll("u1");
    await expect(old).resolves.toEqual([]);
  });

  it("drop отклоняет ожидающие задания", async () => {
    const poll = hub.poll("u1");
    const req = hub.request("u1", { method: "GET", path: "/api/queue" });
    await poll;
    hub.drop("u1");
    await expect(req).rejects.toBeInstanceOf(AgentOfflineError);
    expect(hub.isOnline("u1")).toBe(false);
  });
});
