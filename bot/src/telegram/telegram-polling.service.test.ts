import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../logger.js", () => ({ default: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() } }));
const config = vi.hoisted(() => ({ botPolling: true }));
vi.mock("../config.js", () => ({ config }));

const { TelegramPollingService } = await import("./telegram-polling.service.js");
const logger = (await import("../logger.js")).default;
type BotArg = ConstructorParameters<typeof TelegramPollingService>[0];

function setup() {
  const bot = { catch: vi.fn(), start: vi.fn(), stop: vi.fn().mockResolvedValue(undefined), isRunning: vi.fn().mockReturnValue(true) };
  return { bot, service: new TelegramPollingService(bot as unknown as BotArg) };
}

describe("TelegramPollingService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    config.botPolling = true;
  });

  it("ошибка обработчика — в лог, polling не останавливается (свой bot.catch вместо дефолтного grammY)", () => {
    const { bot, service } = setup();
    service.onModuleInit();
    const handler = bot.catch.mock.calls[0]![0];
    handler({ error: new Error("boom"), ctx: { update: { update_id: 7 }, from: { id: 1 } } });
    expect(logger.error).toHaveBeenCalledWith(expect.objectContaining({ updateId: 7, userId: 1 }), expect.any(String));
  });

  it("старт polling не ждём: bootstrap возвращается сразу, падение start — в лог", async () => {
    const { bot, service } = setup();
    let fail!: (e: Error) => void;
    bot.start.mockReturnValue(new Promise((_, reject) => (fail = reject)));
    expect(service.onApplicationBootstrap()).toBeUndefined();
    fail(new Error("409 Conflict"));
    await vi.waitFor(() => expect(logger.error).toHaveBeenCalled());
  });

  it("BOT_POLLING выключен — бот не стартует", () => {
    const { bot, service } = setup();
    config.botPolling = false;
    service.onApplicationBootstrap();
    expect(bot.start).not.toHaveBeenCalled();
  });

  it("завершение: останавливаем только запущенный бот; сбой stop — в лог, не исключение", async () => {
    const { bot, service } = setup();
    bot.isRunning.mockReturnValueOnce(false);
    await service.onApplicationShutdown();
    expect(bot.stop).not.toHaveBeenCalled();

    bot.stop.mockRejectedValueOnce(new Error("network"));
    await expect(service.onApplicationShutdown()).resolves.toBeUndefined();
    expect(logger.error).toHaveBeenCalled();
  });

  it("stop завис — ждём не дольше таймаута, затем warn", async () => {
    vi.useFakeTimers();
    try {
      const { bot, service } = setup();
      bot.stop.mockReturnValue(new Promise(() => {}));
      const done = service.onApplicationShutdown("SIGTERM");
      await vi.advanceTimersByTimeAsync(5_000);
      await expect(done).resolves.toBeUndefined();
      expect(logger.warn).toHaveBeenCalledWith(expect.anything(), "Bot stop timed out");
    } finally {
      vi.useRealTimers();
    }
  });

  it("сигнал пришёл, пока бот ещё стартовал — polling останавливается сразу после старта", async () => {
    const { bot, service } = setup();
    bot.start.mockReturnValue(new Promise(() => {}));
    service.onApplicationBootstrap();
    bot.isRunning.mockReturnValue(false);
    await service.onApplicationShutdown("SIGTERM");
    expect(bot.stop).not.toHaveBeenCalled();
    bot.start.mock.calls[0]![0].onStart({ username: "rp_bot" });
    await vi.waitFor(() => expect(bot.stop).toHaveBeenCalledTimes(1));
  });
});
