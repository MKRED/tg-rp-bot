import { describe, expect, it } from "vitest";
import { arrangedKeys, identityOrder, isReordered, orderFromKeys, swapOrder, tileKeys } from "./referenceOrder";

describe("referenceOrder", () => {
  it("исходный порядок не считается перестановкой", () => {
    expect(identityOrder(3)).toEqual([0, 1, 2]);
    expect(isReordered([0, 1, 2])).toBe(false);
    expect(isReordered([1, 0, 2])).toBe(true);
  });

  it("«Левее / Правее» меняет с соседкой, за краем — null", () => {
    expect(swapOrder(3, 1, -1)).toEqual([1, 0, 2]);
    expect(swapOrder(3, 1, 1)).toEqual([0, 2, 1]);
    expect(swapOrder(3, 0, -1)).toBeNull();
    expect(swapOrder(3, 2, 1)).toBeNull();
  });
});

describe("ключи плиток", () => {
  const a = "data:image/webp;base64,AAAA";
  const b = "data:image/webp;base64,BBBBBB";

  it("ключ следует за картинкой, повторы различаются", () => {
    const keys = tileKeys([a, b, a]);
    expect(new Set(keys).size).toBe(3);
    // После перестановки у картинки b тот же ключ, что и до неё.
    expect(tileKeys([b, a])[0]).toBe(keys[1]);
  });

  it("порядок ключей переводится в перестановку слотов", () => {
    const keys = tileKeys([a, b]);
    expect(orderFromKeys(keys, [keys[1]!, keys[0]!])).toEqual([1, 0]);
  });

  it("устаревший порядок заменяется порядком сервера", () => {
    const keys = tileKeys([a, b]);
    expect(arrangedKeys(keys, [keys[1]!, keys[0]!])).toEqual([keys[1], keys[0]]);
    expect(arrangedKeys(keys, [keys[0]!])).toEqual(keys);
  });
});
