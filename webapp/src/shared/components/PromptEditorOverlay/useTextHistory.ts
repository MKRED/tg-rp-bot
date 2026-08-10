import { useCallback, useEffect, useRef, useState } from "react";
import {
  canRedoText,
  canUndoText,
  createTextHistory,
  currentTextEntry,
  pushTextEntry,
  redoTextHistory,
  undoTextHistory,
  type TextHistoryState,
} from "./textHistory";

// Пауза набора, после которой очередное нажатие считается отдельным шагом истории —
// иначе каждая буква стала бы своим undo-шагом.
const DEBOUNCE_MS = 700;

export interface UseTextHistoryResult {
  draft: string;
  canUndo: boolean;
  canRedo: boolean;
  /** Вызывать на каждое изменение textarea — коалесцирует быстрый набор в один шаг истории. */
  onChange: (value: string) => void;
  /** Немедленный отдельный шаг истории — для программных правок (очистка, вставка). */
  commit: (value: string) => void;
  undo: () => void;
  redo: () => void;
  /** Заменяет ВСЮ историю (не шаг) — для переключения буфера режима перевода на новое значение,
   * без протаскивания истории предыдущего языка/сессии. */
  reset: (value: string) => void;
}

export function useTextHistory(initialValue: string): UseTextHistoryResult {
  const [draft, setDraft] = useState(initialValue);
  const stateRef = useRef<TextHistoryState>(createTextHistory(initialValue));
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [, bump] = useState(0);

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    [],
  );

  const flushPending = useCallback((value: string) => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    stateRef.current = pushTextEntry(stateRef.current, value);
  }, []);

  const onChange = useCallback((value: string) => {
    setDraft(value);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      stateRef.current = pushTextEntry(stateRef.current, value);
      bump((n) => n + 1);
    }, DEBOUNCE_MS);
  }, []);

  const commit = useCallback(
    (value: string) => {
      flushPending(value);
      setDraft(value);
      bump((n) => n + 1);
    },
    [flushPending],
  );

  const undo = useCallback(() => {
    // Незафиксированный набор (внутри паузы дебаунса) сначала фиксируем — иначе undo
    // откатит не к предыдущему шагу, а молча стёр бы текущий недописанный ввод.
    flushPending(draft);
    stateRef.current = undoTextHistory(stateRef.current);
    setDraft(currentTextEntry(stateRef.current));
    bump((n) => n + 1);
  }, [draft, flushPending]);

  const redo = useCallback(() => {
    // Незафиксированный набор относится к состоянию ДО прыжка вперёд и должен быть
    // отброшен, а не зафиксирован — иначе таймер позже допишет его поверх redo-шага
    // в обход draft, и следующий undo подставит текст, которого пользователь не ожидает.
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    stateRef.current = redoTextHistory(stateRef.current);
    setDraft(currentTextEntry(stateRef.current));
    bump((n) => n + 1);
  }, []);

  const reset = useCallback((value: string) => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    stateRef.current = createTextHistory(value);
    setDraft(value);
    bump((n) => n + 1);
  }, []);

  return {
    draft,
    canUndo: canUndoText(stateRef.current),
    canRedo: canRedoText(stateRef.current),
    onChange,
    commit,
    undo,
    redo,
    reset,
  };
}
