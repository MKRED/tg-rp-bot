import { describe, expect, it } from "vitest";
import { reencryptValue } from "./reencrypt-value.js";

const swap = (token: string) => token.replace("v1:", "v2:");

describe("reencryptValue", () => {
  it("строка-токен v1 заменяется, прочие строки и null — нет", () => {
    expect(reencryptValue("v1:abc", swap)).toEqual({ value: "v2:abc", swapped: 1 });
    expect(reencryptValue("Имя персонажа", swap)).toEqual({ value: "Имя персонажа", swapped: 0 });
    expect(reencryptValue(null, swap)).toEqual({ value: null, swapped: 0 });
  });

  it("text[] — каждый элемент", () => {
    expect(reencryptValue(["v1:a", "v1:b"], swap)).toEqual({ value: ["v2:a", "v2:b"], swapped: 2 });
  });

  it("jsonb любой вложенности: значения меняются, ключи и открытые поля — нет", () => {
    const categories = [
      { id: "c1", enabled: true, title: "v1:t", askUserAnswers: [{ question: "v1:q", answer: "v1:a" }] },
    ];
    const { value, swapped } = reencryptValue(categories, swap);
    expect(swapped).toBe(3);
    expect(value).toEqual([
      { id: "c1", enabled: true, title: "v2:t", askUserAnswers: [{ question: "v2:q", answer: "v2:a" }] },
    ]);
  });

  it("кэш переводов: коды языков остаются ключами", () => {
    expect(reencryptValue({ ru: "v1:x", en: "v1:y" }, swap)).toEqual({ value: { ru: "v2:x", en: "v2:y" }, swapped: 2 });
  });
});
