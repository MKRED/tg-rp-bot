import { BadRequestException, ConflictException, HttpException, NotFoundException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";

vi.mock("../logger.js", () => ({ default: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() } }));

const { ApiExceptionFilter, toErrorBody } = await import("./api-exception.filter.js");

function makeHost() {
  const json = vi.fn();
  const status = vi.fn(() => ({ json }));
  const host = {
    switchToHttp: () => ({
      getRequest: () => ({ method: "GET", path: "/api/x" }),
      getResponse: () => ({ status }),
    }),
  };
  return { host: host as never, status, json };
}

describe("toErrorBody", () => {
  it("встроенное исключение с текстом → { error }", () => {
    expect(toErrorBody(new NotFoundException("Not found").getResponse())).toEqual({ error: "Not found" });
    expect(toErrorBody(new ConflictException("in_use").getResponse())).toEqual({ error: "in_use" });
  });

  it("массив сообщений ValidationPipe склеивается", () => {
    const payload = new BadRequestException(["Name is required", "Tags must be an array of strings"]).getResponse();
    expect(toErrorBody(payload)).toEqual({ error: "Name is required; Tags must be an array of strings" });
  });

  it("собственное тело без statusCode — как есть", () => {
    const payload = new HttpException({ error: "no_api_key", message: "Добавьте ключ" }, 400).getResponse();
    expect(toErrorBody(payload)).toEqual({ error: "no_api_key", message: "Добавьте ключ" });
  });

  it("строковый payload", () => {
    expect(toErrorBody("boom")).toEqual({ error: "boom" });
  });
});

describe("ApiExceptionFilter", () => {
  it("HttpException — его статус и тело контракта", () => {
    const { host, status, json } = makeHost();
    new ApiExceptionFilter().catch(new NotFoundException("Not found"), host);
    expect(status).toHaveBeenCalledWith(404);
    expect(json).toHaveBeenCalledWith({ error: "Not found" });
  });

  it("неизвестная ошибка — 500 Internal error", () => {
    const { host, status, json } = makeHost();
    new ApiExceptionFilter().catch(new Error("db down"), host);
    expect(status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith({ error: "Internal error" });
  });
});
