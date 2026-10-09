import { HttpException } from "@nestjs/common";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../logger.js", () => ({ default: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() } }));
const media = vi.hoisted(() => ({ getProfilePhotoDataUrl: vi.fn(), sendLightboxPhoto: vi.fn() }));
vi.mock("./media/index.js", () => media);

const { MeService } = await import("./me.service.js");
const logger = (await import("../logger.js")).default;

const REQ = { image: "data:image/jpeg;base64,AAAA", label: "Алиса", deepLink: "/characters/1" };

describe("MeService", () => {
  beforeEach(() => vi.clearAllMocks());

  it("фото профиля: data URL или null от Bot API", async () => {
    media.getProfilePhotoDataUrl.mockResolvedValueOnce("data:image/jpeg;base64,X").mockResolvedValueOnce(null);
    const service = new MeService();
    await expect(service.profilePhoto(5)).resolves.toBe("data:image/jpeg;base64,X");
    await expect(service.profilePhoto(5)).resolves.toBeNull();
    expect(media.getProfilePhotoDataUrl).toHaveBeenCalledWith(5);
  });

  it("фото профиля: сбой — null и logger.error, а не ошибка", async () => {
    media.getProfilePhotoDataUrl.mockRejectedValue(new Error("network"));
    await expect(new MeService().profilePhoto(5)).resolves.toBeNull();
    expect(logger.error).toHaveBeenCalled();
  });

  it("отправка фото: image уходит как dataUrl в личку по Telegram id", async () => {
    media.sendLightboxPhoto.mockResolvedValue(undefined);
    await new MeService().sendPhoto(5, REQ);
    expect(media.sendLightboxPhoto).toHaveBeenCalledWith(5, { dataUrl: REQ.image, label: "Алиса", deepLink: "/characters/1" });
  });

  it("отправка фото: сбой Bot API — 502 { error: send_failed }", async () => {
    media.sendLightboxPhoto.mockRejectedValue(new Error("403 Forbidden: bot was blocked by the user"));
    const err = await new MeService().sendPhoto(5, REQ).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(HttpException);
    expect((err as HttpException).getStatus()).toBe(502);
    expect((err as HttpException).getResponse()).toEqual({ error: "send_failed" });
  });
});
