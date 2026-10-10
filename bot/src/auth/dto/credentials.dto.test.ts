import { BadRequestException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";

vi.mock("../../logger.js", () => ({ default: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() } }));

const { createValidationPipe } = await import("../../common/validation-pipe.js");
const { toErrorBody } = await import("../../common/api-exception.filter.js");
const { CredentialsDto } = await import("./credentials.dto.js");

async function viaDto(body: unknown): Promise<Record<string, unknown> | { error: string }> {
  try {
    return { ...(await createValidationPipe().transform(body, { type: "body", metatype: CredentialsDto })) };
  } catch (err) {
    if (!(err instanceof BadRequestException)) throw err;
    return toErrorBody(err.getResponse()) as { error: string };
  }
}

describe("CredentialsDto", () => {
  it("логин обрезается и приводится к нижнему регистру, пароль — как есть", async () => {
    expect(await viaDto({ login: "  Alice_1 ", password: " secret 12 " })).toEqual({ login: "alice_1", password: " secret 12 " });
  });

  it.each([
    ["короткий логин", { login: "ab", password: "12345678" }, "Login must"],
    ["кириллица в логине", { login: "алиса", password: "12345678" }, "Login must"],
    ["пробел в логине", { login: "a b c", password: "12345678" }, "Login must"],
    ["короткий пароль", { login: "alice", password: "1234567" }, "Password must"],
    ["длинный пароль", { login: "alice", password: "x".repeat(129) }, "Password must"],
    ["пароль не строка", { login: "alice", password: 12345678 }, "Password must"],
  ])("%s → 400", async (_title, body, message) => {
    const result = await viaDto(body);
    expect("error" in result && String(result.error)).toContain(message);
  });

  it("лишние поля отсекаются", async () => {
    expect(await viaDto({ login: "alice", password: "12345678", admin: true })).toEqual({ login: "alice", password: "12345678" });
  });
});
