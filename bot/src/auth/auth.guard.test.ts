import { type ExecutionContext, ForbiddenException, UnauthorizedException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { describe, expect, it, vi } from "vitest";

vi.mock("../logger.js", () => ({ default: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() } }));
// Без dev-обхода: запрос без способа входа должен получать 401.
vi.mock("../config.js", () => ({ config: { botToken: "123:test", devUserId: undefined, isProduction: true } }));
vi.mock("../users/users.service.js", () => ({ UsersService: class {} }));
vi.mock("./session/sessions.service.js", () => ({ SessionsService: class {} }));

const { AuthGuard } = await import("./auth.guard.js");
const { Public } = await import("./public.decorator.js");
type Users = ConstructorParameters<typeof AuthGuard>[0];
type Sessions = ConstructorParameters<typeof AuthGuard>[1];

class Controller {
  @Public()
  open() {}
  closed() {}
}

interface Req {
  method?: string;
  headers?: Record<string, string>;
}

function call(handler: () => void, { method = "GET", headers = {} }: Req = {}, resolved: unknown = null) {
  const request: Record<string, unknown> = {
    method,
    headers,
    get: (name: string) => headers[name.toLowerCase()],
  };
  const response = { cookie: vi.fn() };
  const sessions = { resolve: vi.fn().mockResolvedValue(resolved) };
  const users = { ensureTelegramUser: vi.fn() };
  const context = {
    getHandler: () => handler,
    getClass: () => Controller,
    switchToHttp: () => ({ getRequest: () => request, getResponse: () => response }),
  } as unknown as ExecutionContext;
  const guard = new AuthGuard(users as unknown as Users, sessions as unknown as Sessions, new Reflector());
  return { result: guard.canActivate(context), request, response, sessions };
}

const CSRF = { "x-requested-with": "tg-rp-bot" };

describe("AuthGuard", () => {
  it("@Public() GET — пропускает без способа входа", async () => {
    await expect(call(Controller.prototype.open).result).resolves.toBe(true);
  });

  it("без initData, cookie и dev-обхода — 401; с поддельной подписью — 401", async () => {
    await expect(call(Controller.prototype.closed).result).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(
      call(Controller.prototype.closed, { headers: { authorization: "tma garbage" } }).result,
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("CSRF: изменяющий запрос без initData и без заголовка — 403, даже на публичном маршруте", async () => {
    await expect(call(Controller.prototype.open, { method: "POST" }).result).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      call(Controller.prototype.closed, { method: "DELETE", headers: { cookie: "tgrp_session=t" } }, { userId: "u1", extended: false }).result,
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(call(Controller.prototype.open, { method: "POST", headers: CSRF }).result).resolves.toBe(true);
  });

  it("CSRF-заголовок не нужен запросам Mini App (initData не приходит из чужого сайта сам)", async () => {
    // Подпись поддельная → 401, но не 403: до проверки CSRF дело не дошло бы с настоящей.
    await expect(
      call(Controller.prototype.closed, { method: "POST", headers: { authorization: "tma garbage" } }).result,
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("cookie сессии — внутренний userId без профиля Telegram", async () => {
    const { result, request, sessions, response } = call(
      Controller.prototype.closed,
      { method: "POST", headers: { cookie: "a=1; tgrp_session=tok", ...CSRF } },
      { userId: "u1", extended: false },
    );
    await expect(result).resolves.toBe(true);
    expect(sessions.resolve).toHaveBeenCalledWith("tok");
    expect(request.userId).toBe("u1");
    expect(request.tgUser).toBeUndefined();
    expect(response.cookie).not.toHaveBeenCalled();
  });

  it("продлённая сессия — cookie переотправляется с новым сроком", async () => {
    const { result, response } = call(
      Controller.prototype.closed,
      { headers: { cookie: "tgrp_session=tok" } },
      { userId: "u1", extended: true },
    );
    await expect(result).resolves.toBe(true);
    expect(response.cookie).toHaveBeenCalledWith("tgrp_session", "tok", expect.objectContaining({ httpOnly: true, secure: true }));
  });

  it("недействительная cookie — 401", async () => {
    await expect(
      call(Controller.prototype.closed, { headers: { cookie: "tgrp_session=old" } }, null).result,
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
