import { describe, expect, it } from "vitest";
import type { CardCategory } from "../../../db/cards/index.js";
import { assembleCardBlockPrompt } from "./promptAssembly.js";

function cat(overrides: Partial<CardCategory> & Pick<CardCategory, "id" | "title">): CardCategory {
  return { description: "", content: "", enabled: true, ...overrides };
}

describe("assembleCardBlockPrompt", () => {
  it("возвращает undefined, если генерировать нечего (все enabled уже с content)", () => {
    const categories = [cat({ id: "base", title: "Base", content: "готово" })];
    expect(assembleCardBlockPrompt("Prompt", categories)).toBeUndefined();
  });

  it("возвращает undefined, если enabled-категорий нет вовсе", () => {
    const categories = [cat({ id: "base", title: "Base", enabled: false })];
    expect(assembleCardBlockPrompt("Prompt", categories)).toBeUndefined();
  });

  it("целью выбирает первую enabled-категорию с пустым content", () => {
    const categories = [
      cat({ id: "base", title: "Base", content: "уже сгенерирован" }),
      cat({ id: "body", title: "Body" }),
      cat({ id: "outfit", title: "Outfit" }),
    ];
    const result = assembleCardBlockPrompt("Prompt", categories);
    expect(result?.targetCategoryId).toBe("body");
  });

  it("исключает disabled-категории из <example> и из истории", () => {
    const categories = [
      cat({ id: "base", title: "Base", description: "Name: ...", content: "готовый Base" }),
      cat({ id: "hidden", title: "Hidden", description: "Skip me", content: "не должно попасть", enabled: false }),
      cat({ id: "body", title: "Body", description: "Тело" }),
    ];
    const result = assembleCardBlockPrompt("Prompt", categories);
    const system = result!.messages[0]!.content;
    expect(system).not.toContain("Hidden");
    expect(system).not.toContain("Skip me");
    expect(system).toContain("# Base");
    expect(system).toContain("# Body");
    const combined = result!.messages.map((m) => m.content).join("\n");
    expect(combined).not.toContain("не должно попасть");
  });

  it("{{example}} в промпте заменяется на <example>-блок (регистронезависимо)", () => {
    const categories = [cat({ id: "base", title: "Base", description: "Name: ..." })];
    const result = assembleCardBlockPrompt("Инструкция.\n{{EXAMPLE}}\nКонец.", categories);
    const system = result!.messages[0]!.content;
    expect(system).toBe("Инструкция.\n<example>\n# Base\nName: ...\n</example>\nКонец.");
  });

  it("без {{example}} в промпте — <example>-блок дописывается в конец", () => {
    const categories = [cat({ id: "base", title: "Base", description: "Name: ..." })];
    const result = assembleCardBlockPrompt("Просто промпт без плейсхолдера.", categories);
    const system = result!.messages[0]!.content;
    expect(system.startsWith("Просто промпт без плейсхолдера.")).toBe(true);
    expect(system).toContain("<example>\n# Base\nName: ...\n</example>");
  });

  it("история — мультитёрн: пары user/assistant для уже сгенерированных, финальный user без прежнего content", () => {
    const categories = [
      cat({ id: "base", title: "Base", content: "Текст Base" }),
      cat({ id: "body", title: "Body", content: "Текст Body" }),
      cat({ id: "outfit", title: "Outfit" }),
    ];
    const result = assembleCardBlockPrompt("Prompt", categories);
    const roles = result!.messages.map((m) => m.role);
    expect(roles).toEqual(["system", "user", "assistant", "user", "assistant", "user"]);
    expect(result!.messages[2]!.content).toBe("Текст Base");
    expect(result!.messages[4]!.content).toBe("Текст Body");
    expect(result!.messages[5]!.content).toContain("Outfit");
    expect(result!.messages[5]!.content).not.toContain("JSON");
  });

  it("повторные вызовы независимы друг от друга (идемпотентность, без module-level состояния)", () => {
    const categories = [cat({ id: "base", title: "Base", description: "D" })];
    // Регрессионный тест: если бы insertExampleBlock когда-нибудь стал хранить regex в module-level
    // константе с флагом g, {{example}} в конце первого промпта сдвинул бы lastIndex, и следующий
    // вызов мог бы не найти плейсхолдер в начале второго промпта.
    assembleCardBlockPrompt("Плейсхолдер в конце {{example}}", categories);
    const second = assembleCardBlockPrompt("{{example}} в начале", categories);
    expect(second!.messages[0]!.content.startsWith("<example>")).toBe(true);
  });
});
