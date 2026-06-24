import { describe, expect, it, vi } from "vitest";
import type { StoryMessageInPath } from "../db/stories/index.js";
import {
  buildStoryMessages,
  CONTINUE_MARKER,
  LEADING_USER_MARKER,
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
    postHistoryInstruction: "",
    premise: "",
    lorebook: [],
    history: [],
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
});
