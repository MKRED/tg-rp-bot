import { describe, expect, it } from "vitest";
import { MalformedCompletionError } from "../errors.js";
import { parseCompletionBody } from "./responseBody.js";

describe("parseCompletionBody", () => {
  const ok = { model: "m", choices: [{ message: { role: "assistant", content: "привет" } }] };

  it("разбирает обычный ответ", () => {
    expect(parseCompletionBody("deepseek", JSON.stringify(ok))).toEqual(ok);
  });

  it("пропускает keep-alive пустые строки перед телом", () => {
    expect(parseCompletionBody("deepseek", "\n\n\n" + JSON.stringify(ok))).toEqual(ok);
  });

  it.each([
    ["null", "null"],
    ["только пустые строки", "\n\n\n"],
    ["не JSON", "<html>502</html>"],
    ["без choices", JSON.stringify({ error: "x" })],
  ])("%s — MalformedCompletionError", (_, body) => {
    expect(() => parseCompletionBody("deepseek", body)).toThrow(MalformedCompletionError);
  });

  it("в ошибку попадает обрезанное начало тела", () => {
    let caught: unknown;
    try {
      parseCompletionBody("deepseek", "\n\nnull");
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(MalformedCompletionError);
    expect((caught as MalformedCompletionError).bodySnippet).toBe("null");
    expect((caught as MalformedCompletionError).provider).toBe("deepseek");
  });
});
