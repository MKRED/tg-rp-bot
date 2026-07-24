import { describe, expect, it, vi } from "vitest";
import type { StoryMessageInPath } from "../../../db/stories/index.js";
import { countTokens } from "../../../utils/index.js";
import { PER_MESSAGE_OVERHEAD } from "../budget.js";
import {
  buildStoryMessages,
  COMPACT_SUMMARY_HEADER,
  CONTINUE_MARKER,
  DEFAULT_NARRATOR_PROMPT_ORDER,
  LEADING_USER_MARKER,
  resolveNarratorMarkers,
  type StoryPromptOptions,
} from "./storyPromptBuilder.js";

let nextId = 1;
function msg(
  role: "user" | "assistant",
  kind: "beat" | "continue" | "directive",
  content: string,
): StoryMessageInPath {
  const id = nextId++;
  return {
    id,
    parentId: id - 1 || null,
    role,
    kind,
    content,
    createdAt: new Date().toISOString(),
    siblingIndex: 0,
    siblingCount: 1,
    siblings: [id],
  };
}

function baseOpts(overrides: Partial<StoryPromptOptions> = {}): StoryPromptOptions {
  return {
    systemPrompt: "You are the narrator.",
    auxiliarySystemPrompt: "",
    postHistoryInstruction: "",
    premise: "",
    lorebook: [],
    promptOrder: DEFAULT_NARRATOR_PROMPT_ORDER,
    history: [],
    continueMarker: CONTINUE_MARKER,
    leadingUserMarker: LEADING_USER_MARKER,
    ...overrides,
  };
}

// Типичный активный путь: открытие + чередование steer/beat, последний узел — живой триггер.
function sampleHistory(): StoryMessageInPath[] {
  nextId = 1;
  return [
    msg("assistant", "beat", "Once upon a time the friends drove through a forest."),
    msg("user", "continue", CONTINUE_MARKER),
    msg("assistant", "beat", "They chatted about the weekend."),
    msg("user", "directive", "a deer runs onto the road"),
    msg("assistant", "beat", "A deer leapt out; tires screeched."),
    msg("user", "directive", "make the mood tense"),
  ];
}

describe("resolveNarratorMarkers", () => {
  it("берёт маркеры из шаблона, когда они непустые", () => {
    const result = resolveNarratorMarkers({ continueMarker: "Продолжай.", leadingUserMarker: "Начни." });
    expect(result).toEqual({ continueMarker: "Продолжай.", leadingUserMarker: "Начни." });
  });

  it("фолбэк на встроенный дефолт, когда маркеры шаблона пустые/пробельные", () => {
    const result = resolveNarratorMarkers({ continueMarker: "  ", leadingUserMarker: "" });
    expect(result).toEqual({ continueMarker: CONTINUE_MARKER, leadingUserMarker: LEADING_USER_MARKER });
  });

  it("фолбэк на встроенный дефолт, когда шаблон отсутствует (null/undefined)", () => {
    expect(resolveNarratorMarkers(null)).toEqual({
      continueMarker: CONTINUE_MARKER,
      leadingUserMarker: LEADING_USER_MARKER,
    });
    expect(resolveNarratorMarkers(undefined)).toEqual({
      continueMarker: CONTINUE_MARKER,
      leadingUserMarker: LEADING_USER_MARKER,
    });
  });
});

describe("buildStoryMessages — нейтрализация", () => {
  it("нейтрализует все user-ходы кроме последнего (живого триггера)", () => {
    const result = buildStoryMessages(baseOpts({ history: sampleHistory() }));

    const userMsgs = result.filter((m) => m.role === "user");
    // leading-user + 3 user-хода из истории
    expect(userMsgs[0]!.content).toBe(LEADING_USER_MARKER);

    // Отыгранная директива «deer» не должна попасть в запрос — она нейтрализована.
    const hasDeer = result.some((m) => m.content.includes("deer runs onto the road"));
    expect(hasDeer).toBe(false);

    // Живой триггер (последний) сохраняет свой текст.
    const last = result[result.length - 1]!;
    expect(last.role).toBe("user");
    expect(last.content).toBe("make the mood tense");
  });

  it("массив заканчивается user-ходом и НЕ начинается с assistant", () => {
    const result = buildStoryMessages(baseOpts({ history: sampleHistory() }));
    expect(result[result.length - 1]!.role).toBe("user");
    // Первый не-system — это leading-user (а не assistant openingBeat).
    const firstNonSystem = result.find((m) => m.role !== "system")!;
    expect(firstNonSystem.role).toBe("user");
    expect(firstNonSystem.content).toBe(LEADING_USER_MARKER);
  });

  it("openingBeat (assistant) идёт сразу после leading-user, без нейтрализации", () => {
    const result = buildStoryMessages(baseOpts({ history: sampleHistory() }));
    const idx = result.findIndex((m) => m.content === LEADING_USER_MARKER);
    expect(result[idx + 1]!.role).toBe("assistant");
    expect(result[idx + 1]!.content).toContain("Once upon a time");
  });
});

describe("buildStoryMessages — системные блоки", () => {
  it("включает премизу и книгу знаний, когда они заданы", () => {
    const result = buildStoryMessages(
      baseOpts({
        premise: "Two friends on a road trip.",
        lorebook: ["Anna — brave driver.", "The forest is foggy."],
        history: sampleHistory(),
      }),
    );
    const systemText = result.filter((m) => m.role === "system").map((m) => m.content).join("\n");
    expect(systemText).toContain("You are the narrator.");
    expect(systemText).toContain("Two friends on a road trip.");
    expect(systemText).toContain("Anna — brave driver.");
    expect(systemText).toContain("The forest is foggy.");
  });

  it("опускает пустые премизу и книгу знаний", () => {
    const result = buildStoryMessages(baseOpts({ history: sampleHistory() }));
    const systemMsgs = result.filter((m) => m.role === "system");
    // Только нарратор-инструкция, без блоков премизы/книги.
    expect(systemMsgs).toHaveLength(1);
  });

  it("включает вспомогательный промпт, когда он задан", () => {
    const result = buildStoryMessages(
      baseOpts({ auxiliarySystemPrompt: "Keep beats short.", history: sampleHistory() }),
    );
    const systemText = result.filter((m) => m.role === "system").map((m) => m.content).join("\n");
    expect(systemText).toContain("Keep beats short.");
  });
});

describe("buildStoryMessages — порядок промптов", () => {
  it("соблюдает порядок системных блоков из promptOrder", () => {
    const result = buildStoryMessages(
      baseOpts({
        premise: "PREMISE_TEXT",
        auxiliarySystemPrompt: "AUX_TEXT",
        // premise раньше auxiliary в этом порядке.
        promptOrder: [
          { id: "system", enabled: true },
          { id: "premise", enabled: true },
          { id: "auxiliary", enabled: true },
          { id: "lorebook", enabled: true },
          { id: "history", enabled: true },
          { id: "postHistory", enabled: false },
        ],
        history: sampleHistory(),
      }),
    );
    const systemMsgs = result.filter((m) => m.role === "system").map((m) => m.content);
    const premiseIdx = systemMsgs.findIndex((c) => c.includes("PREMISE_TEXT"));
    const auxIdx = systemMsgs.findIndex((c) => c.includes("AUX_TEXT"));
    expect(premiseIdx).toBeGreaterThanOrEqual(0);
    expect(auxIdx).toBeGreaterThan(premiseIdx);
  });

  it("выключенный компонент выпадает из запроса", () => {
    const result = buildStoryMessages(
      baseOpts({
        premise: "PREMISE_TEXT",
        promptOrder: [
          { id: "system", enabled: true },
          { id: "premise", enabled: false }, // выключен — не должен попасть
          { id: "auxiliary", enabled: true },
          { id: "lorebook", enabled: true },
          { id: "history", enabled: true },
          { id: "postHistory", enabled: false },
        ],
        history: sampleHistory(),
      }),
    );
    const hasPremise = result.some((m) => m.content.includes("PREMISE_TEXT"));
    expect(hasPremise).toBe(false);
  });

  it("выключенный history не эмитирует ленту и leading-user, не зовёт onTrim", () => {
    const onTrim = vi.fn();
    const result = buildStoryMessages(
      baseOpts({
        promptOrder: [
          { id: "system", enabled: true },
          { id: "history", enabled: false }, // лента выключена
          { id: "postHistory", enabled: false },
          { id: "lorebook", enabled: true },
          { id: "auxiliary", enabled: true },
          { id: "premise", enabled: true },
        ],
        history: sampleHistory(),
        contextSize: 60,
        maxTokens: 16,
        onTrim,
      }),
    );
    // Ни ленты, ни синтетического leading-user — только системные блоки.
    expect(result.every((m) => m.role === "system")).toBe(true);
    expect(result.some((m) => m.content === LEADING_USER_MARKER)).toBe(false);
    // Обрезку не считаем, раз лента не эмитируется.
    expect(onTrim).not.toHaveBeenCalled();
  });

  it("включённый непустой postHistory идёт хвостом отдельным system-сообщением", () => {
    const result = buildStoryMessages(
      baseOpts({
        postHistoryInstruction: "POST_HISTORY_TEXT",
        promptOrder: [
          { id: "system", enabled: true },
          { id: "history", enabled: true },
          { id: "postHistory", enabled: true },
          { id: "lorebook", enabled: true },
          { id: "auxiliary", enabled: true },
          { id: "premise", enabled: true },
        ],
        history: sampleHistory(),
      }),
    );
    const last = result[result.length - 1]!;
    expect(last.role).toBe("system");
    expect(last.content).toBe("POST_HISTORY_TEXT");
    // Живой триггер остаётся отдельным user-сообщением, не слит с postHistory.
    const trigger = result.find((m) => m.content === "make the mood tense");
    expect(trigger?.role).toBe("user");
  });
});

describe("buildStoryMessages — компонент compact (пересказы)", () => {
  it("эмитит блок «story so far» на позиции compact, когда пересказы есть", () => {
    const result = buildStoryMessages(
      baseOpts({
        compactSummaries: ["Recap one.", "Recap two."],
        history: sampleHistory(),
      }),
    );
    const compactMsg = result.find((m) => m.content.startsWith(COMPACT_SUMMARY_HEADER));
    expect(compactMsg?.role).toBe("system");
    expect(compactMsg!.content).toContain("Recap one.");
    expect(compactMsg!.content).toContain("Recap two.");
    // compact в дефолтном порядке стоит перед history (leading-user).
    const compactIdx = result.indexOf(compactMsg!);
    const leadingIdx = result.findIndex((m) => m.content === LEADING_USER_MARKER);
    expect(compactIdx).toBeLessThan(leadingIdx);
  });

  it("пустые/отсутствующие compactSummaries → блок пропускается (число системных блоков не меняется)", () => {
    const withEmpty = buildStoryMessages(baseOpts({ compactSummaries: [], history: sampleHistory() }));
    const without = buildStoryMessages(baseOpts({ history: sampleHistory() }));
    const countSystem = (r: ReturnType<typeof buildStoryMessages>) =>
      r.filter((m) => m.role === "system").length;
    expect(countSystem(withEmpty)).toBe(countSystem(without));
    expect(withEmpty.some((m) => m.content.startsWith(COMPACT_SUMMARY_HEADER))).toBe(false);
  });

  it("compact учитывается в бюджете обрезки (его токены съедают историю сильнее)", () => {
    const onTrimNoCompact = vi.fn();
    buildStoryMessages(
      baseOpts({ history: sampleHistory(), contextSize: 80, maxTokens: 8, onTrim: onTrimNoCompact }),
    );
    const onTrimWithCompact = vi.fn();
    buildStoryMessages(
      baseOpts({
        history: sampleHistory(),
        // Большой пересказ съедает фиксированный бюджет → истории отбрасывается больше.
        compactSummaries: ["word ".repeat(40)],
        contextSize: 80,
        maxTokens: 8,
        onTrim: onTrimWithCompact,
      }),
    );
    const droppedNoCompact = onTrimNoCompact.mock.calls[0]?.[0]?.dropped ?? 0;
    const droppedWithCompact = onTrimWithCompact.mock.calls[0]?.[0]?.dropped ?? 0;
    expect(droppedWithCompact).toBeGreaterThanOrEqual(droppedNoCompact);
  });
});

describe("buildStoryMessages — mergeSystemPrompts", () => {
  it("схлопывает non-history компоненты в одно system-сообщение, обёрнутое по тегам", () => {
    const result = buildStoryMessages(
      baseOpts({
        mergeSystemPrompts: true,
        premise: "PREMISE_TEXT",
        auxiliarySystemPrompt: "AUX_TEXT",
        history: sampleHistory(),
      }),
    );
    const systemMsgs = result.filter((m) => m.role === "system");
    // Один system-блок вместо трёх отдельных (system/premise/auxiliary).
    expect(systemMsgs).toHaveLength(1);
    const merged = systemMsgs[0]!.content;
    expect(merged).toContain("<system>\nYou are the narrator.\n</system>");
    expect(merged).toContain("<premise>\nStory premise:\nPREMISE_TEXT\n</premise>");
    expect(merged).toContain("<auxiliary>\nAUX_TEXT\n</auxiliary>");
  });

  it("не трогает компоненты после history (postHistory остаётся отдельным сообщением)", () => {
    const result = buildStoryMessages(
      baseOpts({
        mergeSystemPrompts: true,
        postHistoryInstruction: "POST_HISTORY_TEXT",
        promptOrder: [
          { id: "system", enabled: true },
          { id: "premise", enabled: true },
          { id: "history", enabled: true },
          { id: "postHistory", enabled: true },
          { id: "lorebook", enabled: true },
          { id: "auxiliary", enabled: true },
        ],
        premise: "PREMISE_TEXT",
        history: sampleHistory(),
      }),
    );
    const systemMsgs = result.filter((m) => m.role === "system");
    // Один схлопнутый блок (system+premise) перед history + отдельный postHistory после.
    expect(systemMsgs).toHaveLength(2);
    expect(systemMsgs[0]!.content).toContain("<premise>");
    expect(systemMsgs[1]!.content).toBe("POST_HISTORY_TEXT");
  });

  it("выключенные/пустые компоненты не попадают в схлопнутый блок", () => {
    const result = buildStoryMessages(
      baseOpts({
        mergeSystemPrompts: true,
        promptOrder: [
          { id: "system", enabled: true },
          { id: "premise", enabled: false },
          { id: "auxiliary", enabled: true },
          { id: "lorebook", enabled: true },
          { id: "history", enabled: true },
          { id: "postHistory", enabled: false },
        ],
        auxiliarySystemPrompt: "",
        history: sampleHistory(),
      }),
    );
    const systemMsgs = result.filter((m) => m.role === "system");
    expect(systemMsgs).toHaveLength(1);
    expect(systemMsgs[0]!.content).toBe("<system>\nYou are the narrator.\n</system>");
  });

  it("mergeSystemPrompts не включён по умолчанию — сохраняет прежнее поведение", () => {
    const result = buildStoryMessages(
      baseOpts({ premise: "PREMISE_TEXT", history: sampleHistory() }),
    );
    const systemMsgs = result.filter((m) => m.role === "system");
    expect(systemMsgs).toHaveLength(2);
  });

  it("бюджет обрезки истории считает РЕАЛЬНЫЙ merged-текст (с тегами), а не сумму компонентов по отдельности", () => {
    const opts = baseOpts({
      mergeSystemPrompts: true,
      auxiliarySystemPrompt: "Keep beats short.",
      history: sampleHistory(),
      maxTokens: 0, // reserve = 0 — упрощает арифметику бюджета
    });

    // Без обрезки — вытаскиваем фактический (единственный) merged system-текст, ровно то, что уйдёт в промпт.
    const unbounded = buildStoryMessages({ ...opts, contextUnlimited: true });
    const mergedSystemMsg = unbounded.find((m) => m.role === "system")!;
    const fixedSystemTokens = countTokens(mergedSystemMsg.content) + PER_MESSAGE_OVERHEAD;
    const leadingUserCost = countTokens(LEADING_USER_MARKER) + PER_MESSAGE_OVERHEAD;
    const lastTriggerCost = countTokens("make the mood tense") + PER_MESSAGE_OVERHEAD;

    // contextSize впритык под fixed+leading — на историю не остаётся ни токена (budget<=0).
    const onTrimNone = vi.fn();
    buildStoryMessages({
      ...opts,
      contextSize: fixedSystemTokens + leadingUserCost,
      onTrim: onTrimNone,
    });
    expect(onTrimNone).toHaveBeenCalledOnce();
    expect(onTrimNone.mock.calls[0]![0].kept).toBe(0);

    // +lastTriggerCost — впритык хватает ровно на живой триггер (последний узел истории).
    const onTrimOne = vi.fn();
    const resultOne = buildStoryMessages({
      ...opts,
      contextSize: fixedSystemTokens + leadingUserCost + lastTriggerCost,
      onTrim: onTrimOne,
    });
    expect(onTrimOne.mock.calls[0]![0].kept).toBe(1);
    expect(resultOne[resultOne.length - 1]!.content).toBe("make the mood tense");
  });
});

describe("buildStoryMessages — обрезка под контекст", () => {
  it("отбрасывает самые старые узлы и зовёт onTrim, сохраняя живой триггер", () => {
    const onTrim = vi.fn();
    const result = buildStoryMessages(
      baseOpts({
        history: sampleHistory(),
        contextSize: 60,
        maxTokens: 16,
        onTrim,
      }),
    );
    expect(onTrim).toHaveBeenCalledOnce();
    // Живой триггер всё равно на месте (последний user).
    expect(result[result.length - 1]!.content).toBe("make the mood tense");
  });

  it("без contextSize не обрезает (onTrim не зовётся)", () => {
    const onTrim = vi.fn();
    buildStoryMessages(baseOpts({ history: sampleHistory(), onTrim }));
    expect(onTrim).not.toHaveBeenCalled();
  });

  it("trim:false → история не урезается, onTrim не зовётся (режим статистики)", () => {
    const onTrim = vi.fn();
    // contextSize:60/maxTokens:16 в режиме trim урезали бы историю (см. тест выше), но trim:false
    // отключает обрезку — все узлы остаются на месте.
    const result = buildStoryMessages(
      baseOpts({ history: sampleHistory(), contextSize: 60, maxTokens: 16, trim: false, onTrim }),
    );
    expect(onTrim).not.toHaveBeenCalled();
    // system + leading-user + 6 узлов истории.
    expect(result).toHaveLength(8);
    // Самый старый узел (openingBeat) не отброшен.
    expect(result.some((m) => m.content.includes("Once upon a time"))).toBe(true);
  });
});
