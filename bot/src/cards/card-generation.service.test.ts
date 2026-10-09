import { HttpException } from "@nestjs/common";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../logger.js", () => ({ default: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() } }));
const generateCardBlock = vi.fn();
const answerCardBlockQuestions = vi.fn();
vi.mock("../server/cards/generation/generateBlock.js", () => ({ generateCardBlock }));
vi.mock("../server/cards/generation/answerQuestions.js", () => ({ answerCardBlockQuestions }));

const { CardGenerationService } = await import("./card-generation.service.js");
const { MissingApiKeyError } = await import("../llm/errors.js");

const service = new CardGenerationService();

/** Пойманная ошибка → { status, body }, как её отдал бы ApiExceptionFilter. */
async function failure(promise: Promise<unknown>) {
  const err = await promise.then(
    () => undefined,
    (e: unknown) => e,
  );
  expect(err).toBeInstanceOf(HttpException);
  return { status: (err as HttpException).getStatus(), body: (err as HttpException).getResponse() };
}

describe("CardGenerationService", () => {
  beforeEach(() => vi.clearAllMocks());

  it("generate без categoryId — следующий блок, без сброса ответов ask_user", async () => {
    generateCardBlock.mockResolvedValue({ ok: true, status: "done", categoryId: "base", content: "text" });
    await expect(service.generate(1, 5, undefined)).resolves.toEqual({ status: "done", categoryId: "base", content: "text" });
    expect(generateCardBlock).toHaveBeenCalledWith(1, 5, undefined, false);
  });

  it("generate с categoryId (даже пустым) — «Перегенерировать» со сбросом ответов", async () => {
    generateCardBlock.mockResolvedValue({ ok: true, status: "done", categoryId: "", content: "" });
    await service.generate(1, 5, "");
    expect(generateCardBlock).toHaveBeenCalledWith(1, 5, "", true);
  });

  it("questions — только status/categoryId/questions, без ok", async () => {
    const questions = [{ question: "Q?", options: ["a"] }];
    generateCardBlock.mockResolvedValue({ ok: true, status: "questions", categoryId: "body", questions });
    await expect(service.generate(1, 5, undefined)).resolves.toStrictEqual({ status: "questions", categoryId: "body", questions });
  });

  it("отказ генерации — HttpException с её статусом и кодом причины", async () => {
    generateCardBlock.mockResolvedValue({ ok: false, status: 400, reason: "preset_required" });
    expect(await failure(service.generate(1, 5, undefined))).toEqual({ status: 400, body: "preset_required" });
  });

  it("нет ключа DeepSeek — 400 { error: no_api_key, message }", async () => {
    generateCardBlock.mockRejectedValue(new MissingApiKeyError());
    const { status, body } = await failure(service.generate(1, 5, undefined));
    expect(status).toBe(400);
    expect(body).toEqual({ error: "no_api_key", message: expect.any(String) });
  });

  it("прочие ошибки пробрасываются как есть (их логирует и превращает в 500 фильтр)", async () => {
    generateCardBlock.mockRejectedValue(new Error("boom"));
    await expect(service.generate(1, 5, undefined)).rejects.toThrow("boom");
  });

  it("answer — передаёт вход как есть и маппит отказ", async () => {
    answerCardBlockQuestions.mockResolvedValue({ ok: false, status: 404, reason: "no_pending_question" });
    expect(await failure(service.answer(1, 5, "a", { skipped: true }))).toEqual({ status: 404, body: "no_pending_question" });
    expect(answerCardBlockQuestions).toHaveBeenCalledWith(1, 5, "a", { skipped: true });
  });
});
