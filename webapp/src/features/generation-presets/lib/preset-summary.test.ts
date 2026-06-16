import { describe, expect, it } from "vitest";
import { presetSummary } from "./preset-summary";
import type { PresetListItem } from "../types/preset";

/** Базовый «пустой» пресет: ничего не задано → нейтральная подпись. */
const base: PresetListItem = {
  id: 1,
  name: "test",
  temperature: null,
  contextUnlimited: false,
  contextSize: null,
  maxTokens: null,
  streaming: false,
  requestReasoning: false,
  reasoningEffort: null,
};

describe("presetSummary", () => {
  it("для пустой конфигурации возвращает нейтральную подпись", () => {
    expect(presetSummary(base)).toBe("Параметры по умолчанию");
  });

  it("показывает температуру с двумя знаками", () => {
    expect(presetSummary({ ...base, temperature: 0.7 })).toBe("темп. 0.70");
  });

  it("безлимитный контекст важнее конкретного размера", () => {
    expect(presetSummary({ ...base, contextUnlimited: true, contextSize: 8000 })).toBe("контекст ∞");
  });

  it("показывает размер контекста, если безлимит выключен", () => {
    expect(presetSummary({ ...base, contextSize: 8000 })).toBe("контекст 8000");
  });

  it("рассуждение показывается только когда запрошено и выбран уровень", () => {
    expect(presetSummary({ ...base, requestReasoning: true, reasoningEffort: null })).toBe(
      "Параметры по умолчанию",
    );
    expect(presetSummary({ ...base, requestReasoning: true, reasoningEffort: "high" })).toBe(
      "рассужд. высокое",
    );
  });

  it("объединяет несколько частей через « · » в заданном порядке", () => {
    const summary = presetSummary({
      ...base,
      temperature: 1.2,
      maxTokens: 512,
      streaming: true,
    });
    expect(summary).toBe("темп. 1.20 · 512 ток. · стриминг");
  });
});
