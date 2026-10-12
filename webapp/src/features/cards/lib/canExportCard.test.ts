import { describe, expect, it } from "vitest";
import type { CardCategory } from "../types/card";
import { canExportCard } from "./canExportCard";

const cat = (enabled: boolean, content: string): CardCategory => ({
  id: crypto.randomUUID(),
  title: "t",
  description: "",
  content,
  enabled,
});

describe("canExportCard", () => {
  it("все включённые заполнены — можно", () => {
    expect(canExportCard([cat(true, "a"), cat(false, ""), cat(true, "b")])).toBe(true);
  });

  it("есть пустой включённый блок (или только пробелы) — нельзя", () => {
    expect(canExportCard([cat(true, "a"), cat(true, "  ")])).toBe(false);
  });

  it("нет включённых категорий — нельзя", () => {
    expect(canExportCard([cat(false, "a")])).toBe(false);
    expect(canExportCard([])).toBe(false);
  });
});
