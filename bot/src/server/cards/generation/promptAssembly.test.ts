import { describe, expect, it } from "vitest";
import type { CardCategory } from "../../../db/cards/index.js";
import { assembleCardBlockPrompt } from "./promptAssembly.js";

function cat(overrides: Partial<CardCategory> & Pick<CardCategory, "id" | "title">): CardCategory {
  return { description: "", content: "", enabled: true, ...overrides };
}

describe("assembleCardBlockPrompt", () => {
  it("возвращает undefined, если генерировать нечего (все enabled уже с content)", () => {
    const categories = [cat({ id: "base", title: "Base", content: "готово" })];
    expect(assembleCardBlockPrompt("System", "Prompt", categories)).toBeUndefined();
  });

  it("возвращает undefined, если enabled-категорий нет вовсе", () => {
    const categories = [cat({ id: "base", title: "Base", enabled: false })];
    expect(assembleCardBlockPrompt("System", "Prompt", categories)).toBeUndefined();
  });

  it("целью выбирает первую enabled-категорию с пустым content", () => {
    const categories = [
      cat({ id: "base", title: "Base", content: "уже сгенерирован" }),
      cat({ id: "body", title: "Body" }),
      cat({ id: "outfit", title: "Outfit" }),
    ];
    const result = assembleCardBlockPrompt("System", "Prompt", categories);
    expect(result?.targetCategoryId).toBe("body");
  });

  it("system-сообщение — systemPrompt как есть, без изменений", () => {
    const categories = [cat({ id: "base", title: "Base" })];
    const result = assembleCardBlockPrompt("Строгие системные инструкции.", "Prompt", categories);
    expect(result!.messages[0]).toEqual({ role: "system", content: "Строгие системные инструкции." });
  });

  it("первая генерация: <example> и запрос блока — одним user-сообщением", () => {
    const categories = [cat({ id: "base", title: "Base", description: "Name: ..." })];
    const result = assembleCardBlockPrompt("System", "Prompt", categories);
    expect(result!.messages).toEqual([
      { role: "system", content: "System" },
      {
        role: "user",
        content: 'Prompt\n\n<example>\n# Base\nName: ...\n</example>\n\nGenerate the "Base" block.',
      },
    ]);
  });

  it("исключает disabled-категории из <example> и из истории", () => {
    const categories = [
      cat({ id: "base", title: "Base", description: "Name: ...", content: "готовый Base" }),
      cat({ id: "hidden", title: "Hidden", description: "Skip me", content: "не должно попасть", enabled: false }),
      cat({ id: "body", title: "Body", description: "Тело" }),
    ];
    const result = assembleCardBlockPrompt("System", "Prompt", categories);
    const combined = result!.messages.map((m) => m.content).join("\n");
    expect(combined).not.toContain("Hidden");
    expect(combined).not.toContain("Skip me");
    expect(combined).not.toContain("не должно попасть");
    expect(result!.messages[1]!.content).toContain("# Base");
    expect(result!.messages[1]!.content).toContain("# Body");
  });

  it("{{example}} в промпте заменяется на <example>-блок (регистронезависимо)", () => {
    const categories = [cat({ id: "base", title: "Base", description: "Name: ..." })];
    const result = assembleCardBlockPrompt("System", "Инструкция.\n{{EXAMPLE}}\nКонец.", categories);
    expect(result!.messages[1]!.content).toBe(
      'Инструкция.\n<example>\n# Base\nName: ...\n</example>\nКонец.\n\nGenerate the "Base" block.',
    );
  });

  it("без {{example}} в промпте — <example>-блок дописывается в конец", () => {
    const categories = [cat({ id: "base", title: "Base", description: "Name: ..." })];
    const result = assembleCardBlockPrompt("System", "Просто промпт без плейсхолдера.", categories);
    const user = result!.messages[1]!.content;
    expect(user.startsWith("Просто промпт без плейсхолдера.")).toBe(true);
    expect(user).toContain("<example>\n# Base\nName: ...\n</example>");
  });

  it("история — мультитёрн: assistant/user-пары для уже сгенерированных, финальный user запрашивает цель", () => {
    const categories = [
      cat({ id: "base", title: "Base", content: "Текст Base" }),
      cat({ id: "body", title: "Body", content: "Текст Body" }),
      cat({ id: "outfit", title: "Outfit" }),
    ];
    const result = assembleCardBlockPrompt("System", "Prompt", categories);
    const roles = result!.messages.map((m) => m.role);
    expect(roles).toEqual(["system", "user", "assistant", "user", "assistant", "user"]);
    expect(result!.messages[2]!.content).toBe("Текст Base");
    expect(result!.messages[3]!.content).toBe('Generate the "Body" block.');
    expect(result!.messages[4]!.content).toBe("Текст Body");
    expect(result!.messages[5]!.content).toBe('Generate the "Outfit" block.');
    // Первый user (основной промпт) не содержит запроса на блок — это генерация не первая.
    expect(result!.messages[1]!.content).not.toContain("Generate the");
  });

  describe("targetCategoryId (перегенерация)", () => {
    it("явная цель — уже заполненный блок, а не первый пустой", () => {
      const categories = [
        cat({ id: "base", title: "Base", content: "Текст Base" }),
        cat({ id: "body", title: "Body", content: "Текст Body" }),
        cat({ id: "outfit", title: "Outfit" }),
      ];
      const result = assembleCardBlockPrompt("System", "Prompt", categories, "base");
      expect(result?.targetCategoryId).toBe("base");
    });

    it("контекст — только блоки строго до цели по позиции; блоки после неё не попадают в messages", () => {
      const categories = [
        cat({ id: "base", title: "Base", content: "Текст Base" }),
        cat({ id: "body", title: "Body", content: "Текст Body" }),
        cat({ id: "outfit", title: "Outfit", content: "Текст Outfit" }),
      ];
      const result = assembleCardBlockPrompt("System", "Prompt", categories, "body");
      const roles = result!.messages.map((m) => m.role);
      expect(roles).toEqual(["system", "user", "assistant", "user"]);
      expect(result!.messages[2]!.content).toBe("Текст Base");
      expect(result!.messages[3]!.content).toBe('Generate the "Body" block.');
      const combined = result!.messages.map((m) => m.content).join("\n");
      expect(combined).not.toContain("Текст Outfit");
      expect(combined).not.toContain("Текст Body");
    });

    it("явная цель — первая enabled-категория: форма первой генерации, старый content цели не используется", () => {
      const categories = [cat({ id: "base", title: "Base", description: "Name: ...", content: "Старый текст Base" })];
      const result = assembleCardBlockPrompt("System", "Prompt", categories, "base");
      expect(result!.messages).toEqual([
        { role: "system", content: "System" },
        {
          role: "user",
          content: 'Prompt\n\n<example>\n# Base\nName: ...\n</example>\n\nGenerate the "Base" block.',
        },
      ]);
    });

    it("явная цель невалидна, если что-то ПЕРЕД ней по позиции ещё не заполнено — undefined", () => {
      const categories = [
        cat({ id: "base", title: "Base" }),
        cat({ id: "body", title: "Body", content: "Текст Body" }),
      ];
      expect(assembleCardBlockPrompt("System", "Prompt", categories, "body")).toBeUndefined();
    });

    it("неизвестный или disabled id — undefined", () => {
      const categories = [
        cat({ id: "base", title: "Base", content: "Текст Base" }),
        cat({ id: "hidden", title: "Hidden", content: "Текст Hidden", enabled: false }),
      ];
      expect(assembleCardBlockPrompt("System", "Prompt", categories, "missing")).toBeUndefined();
      expect(assembleCardBlockPrompt("System", "Prompt", categories, "hidden")).toBeUndefined();
    });
  });

  describe("askUserAnswers — реплеятся как настоящий tool_call/tool_result", () => {
    // Приводим messages[i] к any для доступа к tool_calls/tool_call_id — в остальных тестах файла
    // сообщения плоские ChatMessage, здесь же явно проверяется синтетический протокол function calling.
    it("первая генерация: assistant tool_calls(ask_user) + tool-result сразу после запроса блока", () => {
      const categories = [
        cat({
          id: "base",
          title: "Base",
          description: "Name: ...",
          askUserAnswers: [{ question: "Пол?", answer: "Женский" }],
        }),
      ];
      const result = assembleCardBlockPrompt("System", "Prompt", categories);
      const messages = result!.messages as any[];
      expect(messages.map((m) => m.role)).toEqual(["system", "user", "assistant", "tool"]);
      expect(messages[1].content).toContain('Generate the "Base" block.');
      expect(messages[2].content).toBeNull();
      expect(messages[2].tool_calls[0].function.name).toBe("ask_user");
      expect(JSON.parse(messages[2].tool_calls[0].function.arguments)).toEqual({
        questions: [{ question: "Пол?" }],
      });
      expect(messages[3].tool_call_id).toBe(messages[2].tool_calls[0].id);
      expect(JSON.parse(messages[3].content).answers).toEqual([{ question: "Пол?", answer: "Женский" }]);
    });

    it("ответы уже сгенерированного первого блока — обмен вставлен перед его assistant-content", () => {
      const categories = [
        cat({
          id: "base",
          title: "Base",
          content: "Текст Base",
          askUserAnswers: [{ question: "Пол?", answer: "Женский" }],
        }),
        cat({ id: "body", title: "Body" }),
      ];
      const result = assembleCardBlockPrompt("System", "Prompt", categories);
      const messages = result!.messages as any[];
      expect(messages.map((m) => m.role)).toEqual(["system", "user", "assistant", "tool", "assistant", "user"]);
      expect(messages[1].content).not.toContain("Generate the");
      expect(messages[2].tool_calls[0].function.name).toBe("ask_user");
      expect(JSON.parse(messages[3].content).answers).toEqual([{ question: "Пол?", answer: "Женский" }]);
      expect(messages[4].content).toBe("Текст Base");
      expect(messages[5].content).toBe('Generate the "Body" block.');
    });

    it("ответы промежуточной уже сгенерированной категории — обмен между её blockRequest и content", () => {
      const categories = [
        cat({ id: "base", title: "Base", content: "Текст Base" }),
        cat({
          id: "body",
          title: "Body",
          content: "Текст Body",
          askUserAnswers: [{ question: "Раса?", answer: "Эльф" }],
        }),
        cat({ id: "outfit", title: "Outfit" }),
      ];
      const result = assembleCardBlockPrompt("System", "Prompt", categories);
      const messages = result!.messages as any[];
      expect(messages.map((m) => m.role)).toEqual([
        "system",
        "user",
        "assistant",
        "user",
        "assistant",
        "tool",
        "assistant",
        "user",
      ]);
      expect(messages[3].content).toBe('Generate the "Body" block.');
      expect(messages[4].tool_calls[0].function.name).toBe("ask_user");
      expect(JSON.parse(messages[4].tool_calls[0].function.arguments)).toEqual({
        questions: [{ question: "Раса?" }],
      });
      expect(JSON.parse(messages[5].content).answers).toEqual([{ question: "Раса?", answer: "Эльф" }]);
      expect(messages[6].content).toBe("Текст Body");
      expect(messages[7].content).toBe('Generate the "Outfit" block.');
    });

    it("ответы самой цели — обмен сразу после финального blockRequest", () => {
      const categories = [
        cat({ id: "base", title: "Base", content: "Текст Base" }),
        cat({
          id: "body",
          title: "Body",
          askUserAnswers: [{ question: "Возраст?", answer: "25" }],
        }),
      ];
      const result = assembleCardBlockPrompt("System", "Prompt", categories);
      const messages = result!.messages as any[];
      expect(messages.map((m) => m.role)).toEqual(["system", "user", "assistant", "user", "assistant", "tool"]);
      expect(messages[3].content).toBe('Generate the "Body" block.');
      expect(messages[4].tool_calls[0].function.name).toBe("ask_user");
      expect(JSON.parse(messages[5].content).answers).toEqual([{ question: "Возраст?", answer: "25" }]);
    });

    it("options сохранённого ответа реплеятся в tool_call — не теряются при ответе", () => {
      const categories = [
        cat({
          id: "base",
          title: "Base",
          askUserAnswers: [{ question: "Пол?", answer: "Женский", options: ["Мужской", "Женский"] }],
        }),
      ];
      const result = assembleCardBlockPrompt("System", "Prompt", categories);
      const messages = result!.messages as any[];
      expect(JSON.parse(messages[2].tool_calls[0].function.arguments)).toEqual({
        questions: [{ question: "Пол?", options: ["Мужской", "Женский"] }],
      });
    });

    it("без askUserAnswers — ни одного tool_calls/tool-сообщения в истории", () => {
      const categories = [cat({ id: "base", title: "Base", description: "Name: ..." })];
      const result = assembleCardBlockPrompt("System", "Prompt", categories);
      const messages = result!.messages as any[];
      expect(messages.every((m) => m.role !== "tool" && !("tool_calls" in m))).toBe(true);
    });
  });

  it("повторные вызовы независимы друг от друга (идемпотентность, без module-level состояния)", () => {
    const categories = [cat({ id: "base", title: "Base", description: "D" })];
    // Регрессионный тест: если бы insertExampleBlock когда-нибудь стал хранить regex в module-level
    // константе с флагом g, {{example}} в конце первого промпта сдвинул бы lastIndex, и следующий
    // вызов мог бы не найти плейсхолдер в начале второго промпта.
    assembleCardBlockPrompt("System", "Плейсхолдер в конце {{example}}", categories);
    const second = assembleCardBlockPrompt("System", "{{example}} в начале", categories);
    expect(second!.messages[1]!.content.startsWith("<example>")).toBe(true);
  });
});
