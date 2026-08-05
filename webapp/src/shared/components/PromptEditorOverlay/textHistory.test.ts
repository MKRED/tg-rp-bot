import { describe, expect, it } from "vitest";
import {
  canRedoText,
  canUndoText,
  createTextHistory,
  currentTextEntry,
  pushTextEntry,
  redoTextHistory,
  undoTextHistory,
} from "./textHistory";

describe("textHistory", () => {
  it("starts with a single entry and nothing to undo/redo", () => {
    const state = createTextHistory("hello");
    expect(currentTextEntry(state)).toBe("hello");
    expect(canUndoText(state)).toBe(false);
    expect(canRedoText(state)).toBe(false);
  });

  it("pushes new entries and allows undo back to the previous one", () => {
    let state = createTextHistory("a");
    state = pushTextEntry(state, "ab");
    state = pushTextEntry(state, "abc");
    expect(currentTextEntry(state)).toBe("abc");

    state = undoTextHistory(state);
    expect(currentTextEntry(state)).toBe("ab");
    expect(canRedoText(state)).toBe(true);

    state = undoTextHistory(state);
    expect(currentTextEntry(state)).toBe("a");
    expect(canUndoText(state)).toBe(false);
  });

  it("redo replays entries undone previously", () => {
    let state = createTextHistory("a");
    state = pushTextEntry(state, "ab");
    state = undoTextHistory(state);
    state = redoTextHistory(state);
    expect(currentTextEntry(state)).toBe("ab");
    expect(canRedoText(state)).toBe(false);
  });

  it("pushing after undo drops the redo tail", () => {
    let state = createTextHistory("a");
    state = pushTextEntry(state, "ab");
    state = pushTextEntry(state, "abc");
    state = undoTextHistory(state);
    state = pushTextEntry(state, "abx");
    expect(currentTextEntry(state)).toBe("abx");
    expect(canRedoText(state)).toBe(false);
  });

  it("ignores a push that repeats the current value", () => {
    const state = createTextHistory("a");
    const next = pushTextEntry(state, "a");
    expect(next).toBe(state);
  });

  it("caps history length so it doesn't grow unbounded", () => {
    let state = createTextHistory("0");
    for (let i = 1; i <= 60; i++) {
      state = pushTextEntry(state, String(i));
    }
    expect(state.entries.length).toBeLessThanOrEqual(50);
    expect(currentTextEntry(state)).toBe("60");
    expect(state.entries[0]).toBe("11");
  });

  it("undo/redo on a single-entry history is a no-op", () => {
    const state = createTextHistory("solo");
    expect(undoTextHistory(state)).toBe(state);
    expect(redoTextHistory(state)).toBe(state);
  });
});
