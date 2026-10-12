import { describe, expect, it } from "vitest";
import type { ChatDetail, ChatSettings, MessageInPath } from "../types/chat";
import { translateFlags, withTranslation } from "./translations";

const msg = (id: number, translations: Record<string, string> | null): MessageInPath =>
  ({ id, role: "assistant", content: "текст", translations }) as MessageInPath;
const chat = (messages: MessageInPath[]): ChatDetail => ({ messages }) as ChatDetail;

describe("withTranslation", () => {
  it("добавляет перевод нужному сообщению, не трогая другие языки", () => {
    const res = withTranslation(chat([msg(1, { de: "Text" }), msg(2, null)]), 1, "en", "text");
    expect(res?.messages[0]?.translations).toEqual({ de: "Text", en: "text" });
    expect(res?.messages[1]?.translations).toBeNull();
  });

  it("убирает перевод при null", () => {
    const res = withTranslation(chat([msg(1, { en: "text", de: "Text" })]), 1, "en", null);
    expect(res?.messages[0]?.translations).toEqual({ de: "Text" });
  });

  it("без чата — null", () => {
    expect(withTranslation(null, 1, "en", "text")).toBeNull();
  });
});

describe("translateFlags", () => {
  const base: ChatSettings = {
    translateEnabled: true,
    translateTargetLang: "ru",
    translateScope: "assistant",
    autoTranslateScope: "none",
    translateMethod: "google",
  };

  it("кнопка — по translateScope, автоперевод выключен", () => {
    expect(translateFlags(base, "assistant")).toEqual({ button: true, autoShow: false });
    expect(translateFlags(base, "user")).toEqual({ button: false, autoShow: false });
  });

  it("автоперевод — по autoTranslateScope", () => {
    expect(translateFlags({ ...base, autoTranslateScope: "all" }, "user").autoShow).toBe(true);
  });

  it("перевод выключен — ничего", () => {
    expect(translateFlags({ ...base, translateEnabled: false, translateScope: "all" }, "user")).toEqual({
      button: false,
      autoShow: false,
    });
  });
});
