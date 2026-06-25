import { apiFetch } from "../../../shared/api/client";
import type { StoryCreateInput, StoryDetail, StoryListItem, StoryMessage } from "../types/story";
import { readStorySSE } from "./sse";

/** CRUD-обёртки и стриминговое ведение narrator-историй. Граница webapp → /api/stories. */

export function listStories(
  page = 1,
  pageSize = 50,
): Promise<{ items: StoryListItem[]; total: number }> {
  return apiFetch<{ items: StoryListItem[]; total: number }>(
    `/stories?page=${page}&pageSize=${pageSize}`,
  );
}

export function getStory(id: number): Promise<{ story: StoryDetail }> {
  return apiFetch<{ story: StoryDetail }>(`/stories/${id}`);
}

export function createStory(input: StoryCreateInput): Promise<{ story: { id: number } }> {
  return apiFetch<{ story: { id: number } }>("/stories", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function renameStory(id: number, title: string): Promise<{ title: string | null }> {
  return apiFetch<{ title: string | null }>(`/stories/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ title }),
  });
}

export function updateStoryPremise(id: number, premise: string): Promise<{ premise: string }> {
  return apiFetch<{ premise: string }>(`/stories/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ premise }),
  });
}

export function removeStory(id: number): Promise<{ ok: true }> {
  return apiFetch<{ ok: true }>(`/stories/${id}`, { method: "DELETE" });
}

export type StoryStreamEvents = {
  onUserMessage?: (msg: StoryMessage) => void;
  onToken?: (text: string) => void;
  onReset?: () => void;
  onDone?: (msg: StoryMessage) => void;
  onError?: (message: string) => void;
};

function dispatch(events: StoryStreamEvents, event: string, data: Record<string, unknown>): void {
  if (event === "userMessage") events.onUserMessage?.(data as unknown as StoryMessage);
  else if (event === "token") events.onToken?.(data.text as string);
  else if (event === "reset") events.onReset?.();
  else if (event === "done") events.onDone?.(data as unknown as StoryMessage);
  else if (event === "error") events.onError?.(data.message as string);
}

/** Двигает историю вперёд: пустая директива = «Дальше» (continue), непустая = режиссёрская директива. */
export async function advanceStory(
  storyId: number,
  directive: string,
  events: StoryStreamEvents,
): Promise<void> {
  await readStorySSE(
    `/stories/${storyId}/advance`,
    { directive },
    (e, d) => dispatch(events, e, d),
    (m) => events.onError?.(m),
  );
}

/** Перегенерирует бит как нового сиблинга под тем же user-ходом. */
export async function regenerateBeat(
  storyId: number,
  msgId: number,
  events: StoryStreamEvents,
): Promise<void> {
  await readStorySSE(
    `/stories/${storyId}/messages/${msgId}/regenerate`,
    {},
    (e, d) => dispatch(events, e, d),
    (m) => events.onError?.(m),
  );
}

export function switchBranch(storyId: number, msgId: number): Promise<void> {
  return apiFetch(`/stories/${storyId}/messages/${msgId}/branch`, { method: "POST" });
}

/** Переводит бит/директиву; сервер кэширует результат в translations сообщения. */
export async function translateStoryMessage(
  storyId: number,
  msgId: number,
  targetLang: string,
): Promise<string> {
  const res = await apiFetch<{ translation: string }>(
    `/stories/${storyId}/messages/${msgId}/translate`,
    { method: "POST", body: JSON.stringify({ targetLang }) },
  );
  return res.translation;
}

export function deleteStoryMessage(storyId: number, msgId: number): Promise<void> {
  return apiFetch(`/stories/${storyId}/messages/${msgId}`, { method: "DELETE" });
}
