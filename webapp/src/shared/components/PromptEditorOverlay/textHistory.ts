export interface TextHistoryState {
  entries: string[];
  index: number;
}

export const MAX_TEXT_HISTORY = 50;

export function createTextHistory(initialValue: string): TextHistoryState {
  return { entries: [initialValue], index: 0 };
}

export function currentTextEntry(state: TextHistoryState): string {
  // index всегда в границах entries по построению; fallback — только для noUncheckedIndexedAccess.
  return state.entries[state.index] ?? "";
}

export function canUndoText(state: TextHistoryState): boolean {
  return state.index > 0;
}

export function canRedoText(state: TextHistoryState): boolean {
  return state.index < state.entries.length - 1;
}

/**
 * Фиксирует новое значение как отдельный шаг истории — обрезая "будущее" (redo-хвост),
 * если запись пришла после undo. Совпадение со текущим значением игнорируем, чтобы
 * не плодить пустые шаги.
 */
export function pushTextEntry(state: TextHistoryState, value: string): TextHistoryState {
  if (currentTextEntry(state) === value) return state;
  const trimmed = state.entries.slice(0, state.index + 1);
  trimmed.push(value);
  const overflow = trimmed.length - MAX_TEXT_HISTORY;
  if (overflow > 0) {
    return { entries: trimmed.slice(overflow), index: MAX_TEXT_HISTORY - 1 };
  }
  return { entries: trimmed, index: trimmed.length - 1 };
}

export function undoTextHistory(state: TextHistoryState): TextHistoryState {
  return canUndoText(state) ? { ...state, index: state.index - 1 } : state;
}

export function redoTextHistory(state: TextHistoryState): TextHistoryState {
  return canRedoText(state) ? { ...state, index: state.index + 1 } : state;
}
