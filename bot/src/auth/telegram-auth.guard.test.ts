import { type ExecutionContext, UnauthorizedException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { describe, expect, it, vi } from "vitest";

vi.mock("../logger.js", () => ({ default: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() } }));
// Без dev-обхода: запрос без подписи должен получать 401.
vi.mock("../config.js", () => ({ config: { botToken: "123:test", devUserId: undefined } }));
vi.mock("../users/users.service.js", () => ({ UsersService: class {} }));

const { TelegramAuthGuard } = await import("./telegram-auth.guard.js");
const { Public } = await import("./public.decorator.js");
type Users = ConstructorParameters<typeof TelegramAuthGuard>[0];

class Controller {
  @Public()
  open() {}
  closed() {}
}

const context = (handler: () => void, authorization?: string) =>
  ({
    getHandler: () => handler,
    getClass: () => Controller,
    switchToHttp: () => ({ getRequest: () => ({ headers: { authorization } }) }),
  }) as unknown as ExecutionContext;

const guard = () => new TelegramAuthGuard({ ensureTelegramUser: vi.fn() } as unknown as Users, new Reflector());

describe("TelegramAuthGuard", () => {
  it("@Public() — пропускает без initData", async () => {
    await expect(guard().canActivate(context(Controller.prototype.open))).resolves.toBe(true);
  });

  it("обычный маршрут — 401 без подписи и с поддельной подписью", async () => {
    await expect(guard().canActivate(context(Controller.prototype.closed))).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(guard().canActivate(context(Controller.prototype.closed, "tma garbage"))).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
