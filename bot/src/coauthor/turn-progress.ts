import { upsertCoauthorStep, type CoauthorStep } from "@tg-rp-bot/shared";
import type { CoauthorState } from "./turn/state.js";

/** Что происходит в идущем ходе: для страницы, обновлённой посреди него (она опрашивает GET). */
export interface TurnProgress {
  /** Копия состояния, которую ход меняет на месте: в БД она попадёт только в конце хода. */
  state: CoauthorState;
  steps: CoauthorStep[];
}

/** В памяти процесса, как лок чата (chat-lock.ts): после рестарта идущих ходов нет. */
const progress = new Map<number, TurnProgress>();

export function startTurnProgress(chatId: number, state: CoauthorState): void {
  progress.set(chatId, { state, steps: [] });
}

export function recordTurnStep(chatId: number, step: CoauthorStep): void {
  const entry = progress.get(chatId);
  if (entry) entry.steps = upsertCoauthorStep(entry.steps, step);
}

/** Модель перезапущена после сбоя: незавершённые шаги этой попытки уже не закончатся. */
export function dropRunningTurnSteps(chatId: number): void {
  const entry = progress.get(chatId);
  if (entry) entry.steps = entry.steps.filter((s) => s.status !== "running");
}

export function clearTurnProgress(chatId: number): void {
  progress.delete(chatId);
}

export function getTurnProgress(chatId: number): TurnProgress | undefined {
  return progress.get(chatId);
}
