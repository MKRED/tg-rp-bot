import { describe, expect, it, vi } from "vitest";
import {
  buildMessages,
  DEFAULT_IMPERSONATE_TEMPLATE,
  renderImpersonateMessages,
  replacePlaceholders,
  trimHistoryToBudget,
} from "./promptBuilder.js";
import type { BuildMessagesOptions } from "./promptBuilder.js";
import type { MessageInPath } from "../../db/chats/index.js";

// Плоский набор опций (промпты+порядок «из шаблона», лимиты «из пресета») с каноническим
// порядком для тестов.
function makeOpts(overrides: Partial<BuildMessagesOptions> = {}): BuildMessagesOptions {
  return {
    systemPrompt: "Ты помощник.",
    auxiliarySystemPrompt: "Вспомогательный промпт.",
    postHistoryInstruction: "Продолжай историю.",
    promptOrder: [
      { id: "system", enabled: true },
      { id: "characterDescription", enabled: true },
      { id: "userDescription", enabled: false },
      { id: "auxiliary", enabled: true },
      { id: "characterScenario", enabled: false },
      { id: "history", enabled: true },
      { id: "postHistory", enabled: true },
    ],
    contextUnlimited: false,
    contextSize: null,
    maxTokens: null,
    character: { name: "Алиса", prompt: "Ты персонаж Алиса.", scenario: "" },
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
    const opts = makeOpts({ systemPrompt: "", auxiliarySystemPrompt: "" });
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
      persona: { name: "Иван", prompt: "Ты играешь за Ивана." },
    });
    const msgs = buildMessages(opts);
    expect(msgs.some((m) => m.content === "Ты играешь за Ивана.")).toBe(true);
  });

  it("включает characterScenario (role system) если enabled и сценарий непустой", () => {
    const opts = makeOpts({
      promptOrder: [
        { id: "system", enabled: false },
        { id: "characterDescription", enabled: true },
        { id: "userDescription", enabled: false },
        { id: "auxiliary", enabled: false },
        { id: "characterScenario", enabled: true },
        { id: "history", enabled: true },
        { id: "postHistory", enabled: false },
      ],
      character: { name: "Алиса", prompt: "Описание Алисы.", scenario: "Сюжет ведёт к развязке." },
    });
    const msgs = buildMessages(opts);
    // characterDescription + characterScenario + userMessage; сценарий идёт после описания, перед историей
    expect(msgs).toHaveLength(3);
    expect(msgs[0]!.content).toBe("Описание Алисы.");
    expect(msgs[1]!.role).toBe("system");
    expect(msgs[1]!.content).toBe("Сюжет ведёт к развязке.");
    expect(msgs[2]!.content).toBe("Привет!");
  });

  it("пропускает characterScenario если сценарий пустой, даже при enabled", () => {
    const opts = makeOpts({
      promptOrder: [
        { id: "system", enabled: false },
        { id: "characterDescription", enabled: false },
        { id: "userDescription", enabled: false },
        { id: "auxiliary", enabled: false },
        { id: "characterScenario", enabled: true },
        { id: "history", enabled: false },
        { id: "postHistory", enabled: false },
      ],
      character: { name: "Алиса", prompt: "", scenario: "" },
    });
    const msgs = buildMessages(opts);
    // пустой сценарий не попадает → только userMessage
    expect(msgs).toHaveLength(1);
    expect(msgs[0]!.content).toBe("Привет!");
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
      systemPrompt: "",
      auxiliarySystemPrompt: "",
      postHistoryInstruction: "",
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
      promptOrder: [
        { id: "system", enabled: false },
        { id: "characterDescription", enabled: false },
        { id: "userDescription", enabled: false },
        { id: "auxiliary", enabled: false },
        { id: "history", enabled: false },
        { id: "postHistory", enabled: false },
      ],
    });
    const msgs = buildMessages(opts);
    // Только userMessage
    expect(msgs).toHaveLength(1);
    expect(msgs[0]!.content).toBe("Привет!");
  });
});

// Генерирует историю из n сообщений с уникальным содержимым (для проверки, что отброшены старые).
function makeLongHistory(n: number): MessageInPath[] {
  return Array.from({ length: n }, (_, i) => ({
    id: i + 1,
    parentId: i === 0 ? null : i,
    role: (i % 2 === 0 ? "user" : "assistant") as "user" | "assistant",
    content: `Сообщение номер ${i + 1}.`,
    translations: null,
    createdAt: `2024-01-01T00:${String(i).padStart(2, "0")}:00Z`,
    siblingIndex: 0,
    siblingCount: 1,
    siblings: [i + 1],
  }));
}

describe("trimHistoryToBudget", () => {
  const history = makeLongHistory(5);
  // Фейковая стоимость = длина content (детерминированно, без реального токенайзера).
  const cost = (m: MessageInPath) => m.content.length;

  it("budget <= 0 → пустой массив", () => {
    expect(trimHistoryToBudget(history, 0, cost)).toEqual([]);
    expect(trimHistoryToBudget(history, -100, cost)).toEqual([]);
  });

  it("большой бюджет → вся история без изменений, порядок сохранён", () => {
    const kept = trimHistoryToBudget(history, 100000, cost);
    expect(kept).toHaveLength(5);
    expect(kept.map((m) => m.id)).toEqual([1, 2, 3, 4, 5]);
  });

  it("отбрасывает самые СТАРЫЕ, оставляя новые (суффикс) в хронологическом порядке", () => {
    // Каждое сообщение стоит ~18 символов; бюджета на ~2 хватит.
    const kept = trimHistoryToBudget(history, 40, cost);
    expect(kept.length).toBeGreaterThan(0);
    expect(kept.length).toBeLessThan(5);
    // Оставленные — это хвост исходного массива (новейшие), порядок не перевёрнут.
    expect(kept).toEqual(history.slice(history.length - kept.length));
  });
});

describe("buildMessages — обрезка истории под contextSize", () => {
  // Только история + userMessage (без фиксированных промптов), reserve=0 (maxTokens:0).
  function historyOnlyOverrides(
    overrides: Partial<BuildMessagesOptions> = {},
  ): Partial<BuildMessagesOptions> {
    return {
      systemPrompt: "",
      auxiliarySystemPrompt: "",
      postHistoryInstruction: "",
      maxTokens: 0,
      promptOrder: [
        { id: "system", enabled: false },
        { id: "characterDescription", enabled: false },
        { id: "userDescription", enabled: false },
        { id: "auxiliary", enabled: false },
        { id: "history", enabled: true },
        { id: "postHistory", enabled: false },
      ],
      ...overrides,
    };
  }

  it("contextSize=null → история не урезается", () => {
    const history = makeLongHistory(10);
    const msgs = buildMessages(makeOpts({ ...historyOnlyOverrides({ contextSize: null }), history }));
    expect(msgs).toHaveLength(11); // 10 история + userMessage
  });

  it("contextUnlimited=true → история не урезается даже при заданном contextSize", () => {
    const history = makeLongHistory(10);
    const msgs = buildMessages(
      makeOpts({ ...historyOnlyOverrides({ contextUnlimited: true, contextSize: 10 }), history }),
    );
    expect(msgs).toHaveLength(11);
  });

  it("маленький contextSize → остаются только новые сообщения (хвост)", () => {
    const history = makeLongHistory(20);
    const onTrim = vi.fn();
    const msgs = buildMessages(
      makeOpts({ ...historyOnlyOverrides({ contextSize: 30 }), history }),
      { onTrim },
    );
    const historyMsgs = msgs.slice(0, -1); // последний — userMessage
    expect(historyMsgs.length).toBeGreaterThan(0);
    expect(historyMsgs.length).toBeLessThan(20);
    // Оставлены именно новейшие: содержимое совпадает с хвостом исходной истории.
    const keptContents = historyMsgs.map((m) => m.content);
    const tailContents = history.slice(history.length - historyMsgs.length).map((m) => m.content);
    expect(keptContents).toEqual(tailContents);
    // onTrim вызван с числом отброшенных.
    expect(onTrim).toHaveBeenCalledWith(
      expect.objectContaining({ dropped: 20 - historyMsgs.length, total: 20 }),
    );
  });

  it("trim:false → история не урезается, onTrim не вызывается (режим статистики)", () => {
    const history = makeLongHistory(20);
    const onTrim = vi.fn();
    const msgs = buildMessages(
      makeOpts({ ...historyOnlyOverrides({ contextSize: 30 }), history }),
      { trim: false, onTrim },
    );
    expect(msgs).toHaveLength(21);
    expect(onTrim).not.toHaveBeenCalled();
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
      character: { name: "Алиса", prompt: "Описание Алисы.", scenario: "" },
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
      character: { name: "Алиса", prompt: "ОПИС_CHAR", scenario: "" },
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
      character: { name: "Алиса", prompt: "Я — {{char}}, говорю с {{user}}.", scenario: "" },
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
      character: { name: "Алиса", prompt: "X", scenario: "" },
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
      character: { name: "Алиса", prompt: "", scenario: "" },
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
      character: { name: "Алиса", prompt: "", scenario: "" },
      persona: { name: "Иван", prompt: "" },
      systemPrompt: "",
      auxPrompt: "",
      history: [],
    });
    expect(user!.content).toBe("Иван:");
  });

  it("урезает историю под contextSize (самые старые реплики выпадают, новейшая остаётся)", () => {
    const onTrim = vi.fn();
    const [, user] = renderImpersonateMessages({
      template: "t",
      character: { name: "Алиса", prompt: "", scenario: "" },
      persona: { name: "Иван", prompt: "" },
      systemPrompt: "",
      auxPrompt: "",
      history: makeLongHistory(20),
      contextSize: 40,
      maxTokens: 0,
      onTrim,
    });
    expect(user!.content).toContain("Сообщение номер 20.");
    expect(user!.content).not.toContain("Сообщение номер 1.");
    expect(onTrim).toHaveBeenCalled();
  });

  it("без contextSize → история не урезается", () => {
    const onTrim = vi.fn();
    const [, user] = renderImpersonateMessages({
      template: "t",
      character: { name: "Алиса", prompt: "", scenario: "" },
      persona: { name: "Иван", prompt: "" },
      systemPrompt: "",
      auxPrompt: "",
      history: makeLongHistory(20),
      onTrim,
    });
    expect(user!.content).toContain("Сообщение номер 1.");
    expect(user!.content).toContain("Сообщение номер 20.");
    expect(onTrim).not.toHaveBeenCalled();
  });

  it("берёт только последние 30 сообщений даже без contextSize", () => {
    const [, user] = renderImpersonateMessages({
      template: "t",
      character: { name: "Алиса", prompt: "", scenario: "" },
      persona: { name: "Иван", prompt: "" },
      systemPrompt: "",
      auxPrompt: "",
      history: makeLongHistory(50),
    });
    // 50 сообщений → остаются 21..50, более старые выпадают
    expect(user!.content).not.toContain("Сообщение номер 20.");
    expect(user!.content).toContain("Сообщение номер 21.");
    expect(user!.content).toContain("Сообщение номер 50.");
  });
});
