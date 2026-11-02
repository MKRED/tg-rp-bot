import { describe, expect, it } from "vitest";
import { cardToTemplate } from "./cardToTemplate";

const card = {
  systemPrompt: "S",
  categories: [
    {
      id: "base",
      title: "Base",
      description: "Name: ...",
      content: "Имя: Ли",
      enabled: true,
      askUserAnswers: [{ question: "q", answer: "a" }],
    },
    { id: "magic", title: "Magic", description: "Школа магии", content: "", enabled: false },
  ],
  useWebSearch: true,
  useAskUser: true,
  askUserFirst: false,
};

describe("cardToTemplate", () => {
  it("берёт структуру без текста и контекста инструментов, тумблеры — как в карточке", () => {
    expect(cardToTemplate("  NPC ", card, false)).toEqual({
      name: "NPC",
      systemPrompt: "S",
      fields: [
        { id: "base", title: "Base", description: "Name: ...", enabled: true },
        { id: "magic", title: "Magic", description: "Школа магии", enabled: false },
      ],
      useWebSearch: true,
      useAskUser: true,
      askUserFirst: false,
    });
  });

  it("onlyEnabled — выключенные поля не попадают", () => {
    expect(cardToTemplate("N", card, true).fields.map((f) => f.id)).toEqual(["base"]);
  });
});
