import { upsertCoauthorStep } from "@tg-rp-bot/shared";
import type { CoauthorStep } from "../types/coauthor";

/** Что показывать, пока идёт ход: шаги и текст модели в том порядке, в каком они приходят. */
export type LiveItem = { type: "steps"; steps: CoauthorStep[] } | { type: "text"; text: string };

export function appendLiveText(items: LiveItem[], text: string): LiveItem[] {
  const last = items.at(-1);
  if (last?.type === "text") return [...items.slice(0, -1), { type: "text", text: last.text + text }];
  return [...items, { type: "text", text }];
}

/** Шаг с известным id обновляется там, где он уже показан; новый — в конец, к соседним шагам. */
export function upsertLiveStep(items: LiveItem[], step: CoauthorStep): LiveItem[] {
  const known = items.some((item) => item.type === "steps" && item.steps.some((s) => s.id === step.id));
  if (known) {
    return items.map((item) => (item.type === "steps" ? { type: "steps", steps: upsertCoauthorStep(item.steps, step) } : item));
  }
  const last = items.at(-1);
  if (last?.type === "steps") return [...items.slice(0, -1), { type: "steps", steps: [...last.steps, step] }];
  return [...items, { type: "steps", steps: [step] }];
}

/** Сервер перезапустил модель: незавершённые шаги и текст этой попытки надо стереть. */
export function resetLiveAttempt(items: LiveItem[]): LiveItem[] {
  const kept = items.flatMap((item): LiveItem[] => {
    if (item.type === "text") return [item];
    const steps = item.steps.filter((s) => s.status !== "running");
    return steps.length > 0 ? [{ type: "steps", steps }] : [];
  });
  return kept.at(-1)?.type === "text" ? kept.slice(0, -1) : kept;
}

/** ИИ занят чем-то, что уже видно на экране, — отдельный индикатор «думает» не нужен. */
export function liveShowsActivity(items: LiveItem[]): boolean {
  const last = items.at(-1);
  if (!last) return false;
  return last.type === "text" || last.steps.some((s) => s.status === "running");
}
