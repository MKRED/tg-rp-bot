import { describe, expect, it } from "vitest";
import {
  buildMessages,
  DEFAULT_IMPERSONATE_TEMPLATE,
  renderImpersonateMessages,
  replacePlaceholders,
} from "./promptBuilder.js";
import type { BuildMessagesOptions } from "./promptBuilder.js";
import type { MessageInPath } from "../db/chats/index.js";
import type { GenerationPreset } from "../db/schema.js";

// Минимальный пресет с каноническим порядком для тестов
function makePreset(overrides: Partial<GenerationPreset> = {}): GenerationPreset {
  return {
    id: 1,
    userId: 1,
    name: "test",
    contextUnlimited: false,
    contextSize: null,
    maxTokens: null,
    streaming: false,
    temperature: null,
    topP: null,
    topK: null,
    frequencyPenalty: null,
    presencePenalty: null,
    repetitionPenalty: null,
    minP: null,
    topA: null,
    systemPrompt: "Ты помощник.",
    auxiliarySystemPrompt: "Вспомогательный промпт.",
    postHistoryInstruction: "Продолжай историю.",
    userPersonaPrompt: "",
    userPersonaStreaming: true,
    requestReasoning: false,
    reasoningEffort: null,
    promptOrder: [
      { id: "system", enabled: true },
      { id: "characterDescription", enabled: true },
      { id: "userDescription", enabled: false },
      { id: "auxiliary", enabled: true },
      { id: "history", enabled: true },
      { id: "postHistory", enabled: true },
    ],
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function makeOpts(overrides: Partial<BuildMessagesOptions> = {}): BuildMessagesOptions {
  return {
    preset: makePreset(),
    character: { name: "Алиса", prompt: "Ты персонаж Алиса." },
    persona: null,
    history: [],
    userMessage: "Привет!",
    ...overrides,
  };
}

describe("replacePlaceholders", () => {
  it("заменяет {{char}} и {{user}}", () => {
    expect(replacePlaceholders("Привет, {{char}}!", "Алиса", "Иван")).toBe("Привет, Алиса!");
    expect(replacePlaceholders("{{user}} говорит {{char}}", "Боб", "Мария")).toBe("Мария говорит Боб");
  });

  it("регистронезависимо: {{Char}}, {{CHAR}}, {{User}}, {{USER}}", () => {
    expect(replacePlaceholders("{{Char}} и {{User}}", "X", "Y")).toBe("X и Y");
    expect(replacePlaceholders("{{CHAR}} и {{USER}}", "X", "Y")).toBe("X и Y");
  });

  it("заменяет все вхождения", () => {
    expect(replacePlaceholders("{{char}} — {{char}}", "Алиса", "")).toBe("Алиса — Алиса");
  });

  it("не трогает текст без плейсхолдеров", () => {
    const text = "Обычный текст без замен.";
    expect(replacePlaceholders(text, "X", "Y")).toBe(text);
  });
});

describe("buildMessages", () => {
  it("включает system + characterDescription + auxiliary + postHistory + userMessage", () => {
    const msgs = buildMessages(makeOpts());
    const roles = msgs.map((m) => m.role);
    // system, characterDescription, auxiliary — все system; postHistory — user; новое — user
    expect(roles).toEqual(["system", "system", "system", "user", "user"]);
    expect(msgs[0]!.content).toBe("Ты помощник.");
    expect(msgs[1]!.content).toBe("Ты персонаж Алиса.");
    expect(msgs[2]!.content).toBe("Вспомогательный промпт.");
    expect(msgs[3]!.content).toBe("Продолжай историю.");
    expect(msgs[4]!.content).toBe("Привет!");
  });

  it("пропускает пустые промпты компонентов", () => {
    const opts = makeOpts({
      preset: makePreset({ systemPrompt: "", auxiliarySystemPrompt: "" }),
    });
    const msgs = buildMessages(opts);
    // только characterDescription + postHistory + userMessage
    expect(msgs).toHaveLength(3);
    expect(msgs[0]!.content).toBe("Ты персонаж Алиса.");
  });

  it("не включает userDescription если он disabled даже при наличии персоны", () => {
    const opts = makeOpts({ persona: { name: "Иван", prompt: "Ты играешь за Ивана." } });
    const msgs = buildMessages(opts);
    // userDescription disabled → персоны нет в messages
    expect(msgs.every((m) => m.content !== "Ты играешь за Ивана.")).toBe(true);
  });

  it("включает userDescription если enabled и persona задана", () => {
    const opts = makeOpts({
      preset: makePreset({
        promptOrder: [
          { id: "system", enabled: true },
          { id: "characterDescription", enabled: true },
          { id: "userDescription", enabled: true },
          { id: "auxiliary", enabled: false },
          { id: "history", enabled: true },
          { id: "postHistory", enabled: false },
        ],
        systemPrompt: "",
        auxiliarySystemPrompt: "",
        postHistoryInstruction: "",
      }),
      persona: { name: "Иван", prompt: "Ты играешь за Ивана." },
    });
    const msgs = buildMessages(opts);
    expect(msgs.some((m) => m.content === "Ты играешь за Ивана.")).toBe(true);
  });

  it("вставляет историю в правильном порядке", () => {
    const history = [
      {
        id: 1, parentId: null, role: "assistant" as const,
        content: "Привет, путник.", translations: null,
        createdAt: "2024-01-01T00:00:00Z", siblingIndex: 0, siblingCount: 1, siblings: [1],
      },
      {
        id: 2, parentId: 1, role: "user" as const,
        content: "Как дела?", translations: null,
        createdAt: "2024-01-01T00:01:00Z", siblingIndex: 0, siblingCount: 1, siblings: [2],
      },
    ];
    const opts = makeOpts({
      preset: makePreset({
        systemPrompt: "",
        auxiliarySystemPrompt: "",
        postHistoryInstruction: "",
      }),
      history,
    });
    const msgs = buildMessages(opts);
    // characterDescription + history(2) + userMessage
    expect(msgs).toHaveLength(4);
    expect(msgs[1]!.role).toBe("assistant");
    expect(msgs[2]!.role).toBe("user");
    expect(msgs[3]!.content).toBe("Привет!");
  });

  it("пропускает disabled компоненты", () => {
    const opts = makeOpts({
      preset: makePreset({
        promptOrder: [
          { id: "system", enabled: false },
          { id: "characterDescription", enabled: false },
          { id: "userDescription", enabled: false },
          { id: "auxiliary", enabled: false },
          { id: "history", enabled: false },
          { id: "postHistory", enabled: false },
        ],
      }),
    });
    const msgs = buildMessages(opts);
    // Только userMessage
    expect(msgs).toHaveLength(1);
    expect(msgs[0]!.content).toBe("Привет!");
  });
});

// Реальный сценарий impersonate: история кончается репликой персонажа (assistant).
function makeHistory(): MessageInPath[] {
  return [
    {
      id: 1, parentId: null, role: "user",
      content: "Здравствуй, {{char}}.", translations: null,
      createdAt: "2024-01-01T00:00:00Z", siblingIndex: 0, siblingCount: 1, siblings: [1],
    },
    {
      id: 2, parentId: 1, role: "assistant",
      content: "Привет, {{user}}.", translations: null,
      createdAt: "2024-01-01T00:01:00Z", siblingIndex: 0, siblingCount: 1, siblings: [2],
    },
  ];
}

describe("renderImpersonateMessages", () => {
  it("возвращает ровно 2 сообщения: system (шаблон) + user (история)", () => {
    const msgs = renderImpersonateMessages({
      template: "Пиши за {{user}}.",
      character: { name: "Алиса", prompt: "Описание Алисы." },
      persona: { name: "Иван", prompt: "Описание Ивана." },
      systemPrompt: "СИС",
      auxPrompt: "АУКС",
      history: makeHistory(),
    });
    expect(msgs).toHaveLength(2);
    expect(msgs[0]!.role).toBe("system");
    expect(msgs[1]!.role).toBe("user");
  });

  it("подставляет все блочные плейсхолдеры и имена в system", () => {
    const tpl =
      "Роль {{user}} vs {{char}}\n{{char_prompt}}\n{{user_prompt}}\n{{system_prompt}}\n{{aux_prompt}}";
    const [system] = renderImpersonateMessages({
      template: tpl,
      character: { name: "Алиса", prompt: "ОПИС_CHAR" },
      persona: { name: "Иван", prompt: "ОПИС_USER" },
      systemPrompt: "СИС",
      auxPrompt: "АУКС",
      history: [],
    });
    expect(system!.content).toBe("Роль Иван vs Алиса\nОПИС_CHAR\nОПИС_USER\nСИС\nАУКС");
  });

  it("разрешает {{char}}/{{user}} внутри вставленных промптов", () => {
    const [system] = renderImpersonateMessages({
      template: "{{char_prompt}}",
      character: { name: "Алиса", prompt: "Я — {{char}}, говорю с {{user}}." },
      persona: { name: "Иван", prompt: "" },
      systemPrompt: "",
      auxPrompt: "",
      history: [],
    });
    expect(system!.content).toBe("Я — Алиса, говорю с Иван.");
  });

  it("использует дефолтный шаблон при пустом поле", () => {
    const [system] = renderImpersonateMessages({
      template: "   ",
      character: { name: "Алиса", prompt: "X" },
      persona: null,
      systemPrompt: "",
      auxPrompt: "",
      history: [],
    });
    // Дефолт без {{system_prompt}}: плейсхолдер не должен присутствовать в результате
    expect(system!.content).not.toContain("{{system_prompt}}");
    expect(system!.content).toContain("Write 1 reply only");
    // {{user}} в дефолте подставился (персоны нет → "User")
    expect(DEFAULT_IMPERSONATE_TEMPLATE).toContain("{{user}}");
    expect(system!.content).toContain("User");
  });

  it("рендерит историю плоским текстом + затравкой <userName>: в конце (история кончается на assistant)", () => {
    const [, user] = renderImpersonateMessages({
      template: "t",
      character: { name: "Алиса", prompt: "" },
      persona: { name: "Иван", prompt: "" },
      systemPrompt: "",
      auxPrompt: "",
      history: makeHistory(),
    });
    // старые→новые, {{char}}/{{user}} подставлены, и финальная затравка реплики игрока
    expect(user!.content).toBe(
      "Иван:\nЗдравствуй, Алиса.\n\nАлиса:\nПривет, Иван.\n\nИван:",
    );
  });

  it("пустая история → user-сообщение = '<userName>:'", () => {
    const [, user] = renderImpersonateMessages({
      template: "t",
      character: { name: "Алиса", prompt: "" },
      persona: { name: "Иван", prompt: "" },
      systemPrompt: "",
      auxPrompt: "",
      history: [],
    });
    expect(user!.content).toBe("Иван:");
  });
});
