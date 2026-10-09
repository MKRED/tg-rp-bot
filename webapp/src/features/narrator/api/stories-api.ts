import {
  type AdvanceStoryRequest,
  type ChatTranslateTextRequest,
  type EditStoryBeatRequest,
  type EditStoryBeatResponse,
  SSE_EVENTS,
  type StoryCreated,
  type StoryListResponse,
  type TranslateMessageRequest,
  type TranslationResponse,
  type UpdateStoryRequest,
} from "@tg-rp-bot/shared";
import { apiFetch } from "../../../shared/api/client";
import type { TranslateMode } from "../../../shared/components/TranslateSheet";
import type { StoryCreateInput, StoryDetail, StoryMessage } from "../types/story";
import { readStorySSE } from "./sse";

/** CRUD-обёртки и стриминговое ведение narrator-историй. Граница webapp → /api/stories. */

export function listStories(
  page = 1,
  pageSize = 50,
): Promise<StoryListResponse> {
  return apiFetch<StoryListResponse>(
    `/stories?page=${page}&pageSize=${pageSize}`,
  );
}

export function getStory(id: number): Promise<{ story: StoryDetail }> {
  return apiFetch<{ story: StoryDetail }>(`/stories/${id}`);
}

export function createStory(input: StoryCreateInput): Promise<{ story: StoryCreated }> {
  return apiFetch<{ story: StoryCreated }>("/stories", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function renameStory(id: number, title: string): Promise<{ title: string | null }> {
  return apiFetch<{ title: string | null }>(`/stories/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ title } satisfies UpdateStoryRequest),
  });
}

export function updateStoryPremise(id: number, premise: string): Promise<{ premise: string }> {
  return apiFetch<{ premise: string }>(`/stories/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ premise } satisfies UpdateStoryRequest),
  });
}

export function removeStory(id: number): Promise<{ ok: true }> {
  return apiFetch<{ ok: true }>(`/stories/${id}`, { method: "DELETE" });
}

export type StoryStreamEvents = {
  onUserMessage?: (msg: StoryMessage) => void;
  onToken?: (text: string) => void;
  onReset?: () => void;
  /** Статус-событие фоновой фазы перед битом (напр. phase:"compacting" — авто-сжатие истории). */
  onStatus?: (phase: string) => void;
  onDone?: (msg: StoryMessage) => void;
  onError?: (message: string) => void;
};

function dispatch(events: StoryStreamEvents, event: string, data: Record<string, unknown>): void {
  if (event === SSE_EVENTS.userMessage) events.onUserMessage?.(data as unknown as StoryMessage);
  else if (event === SSE_EVENTS.token) events.onToken?.(data.text as string);
  else if (event === SSE_EVENTS.reset) events.onReset?.();
  else if (event === SSE_EVENTS.status) events.onStatus?.(data.phase as string);
  else if (event === SSE_EVENTS.done) events.onDone?.(data as unknown as StoryMessage);
  else if (event === SSE_EVENTS.error) events.onError?.(data.message as string);
}

/** Двигает историю вперёд: пустая директива = «Дальше» (continue), непустая = режиссёрская директива. */
export async function advanceStory(
  storyId: number,
  directive: string,
  events: StoryStreamEvents,
): Promise<void> {
  await readStorySSE(
    `/stories/${storyId}/advance`,
    { directive } satisfies AdvanceStoryRequest,
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

/**
 * Переводит бит/директиву; сервер кэширует результат в translations сообщения (метод google/ai —
 * из настроек истории). force=true пропускает кэш и пересчитывает перевод заново.
 */
export async function translateStoryMessage(
  storyId: number,
  msgId: number,
  targetLang: string,
  opts?: { force?: boolean },
): Promise<string> {
  const body: TranslateMessageRequest = { targetLang, force: opts?.force ?? false };
  const res = await apiFetch<TranslationResponse>(
    `/stories/${storyId}/messages/${msgId}/translate`,
    { method: "POST", body: JSON.stringify(body) },
  );
  return res.translation;
}

/** Убирает закэшированный перевод бита/директивы для одного языка. */
export async function deleteStoryTranslation(
  storyId: number,
  msgId: number,
  targetLang: string,
): Promise<void> {
  await apiFetch(
    `/stories/${storyId}/messages/${msgId}/translate?lang=${encodeURIComponent(targetLang)}`,
    { method: "DELETE" },
  );
}

export function deleteStoryMessage(storyId: number, msgId: number): Promise<void> {
  return apiFetch(`/stories/${storyId}/messages/${msgId}`, { method: "DELETE" });
}

/**
 * Правит текст бита на месте (любого, включая openingBeat) — без перегенерации и без нового
 * сиблинга. Сервер сбрасывает кэш перевода этого сообщения (он относился к старому тексту).
 */
export function editStoryBeat(
  storyId: number,
  msgId: number,
  content: string,
): Promise<EditStoryBeatResponse> {
  return apiFetch<EditStoryBeatResponse>(`/stories/${storyId}/messages/${msgId}/edit`, {
    method: "POST",
    body: JSON.stringify({ content } satisfies EditStoryBeatRequest),
  });
}

/**
 * Перевод черновика директивы перед отправкой (эфемерно, без кэша). mode переключает
 * Google ↔ ИИ-промпт перевода из narrator-шаблона истории. Зеркало composeTranslate из RP.
 */
export async function composeStoryTranslate(
  storyId: number,
  params: { text: string; targetLang: string; mode: TranslateMode },
): Promise<string> {
  const body: ChatTranslateTextRequest = params;
  const res = await apiFetch<TranslationResponse>(`/stories/${storyId}/translate-text`, {
    method: "POST",
    body: JSON.stringify(body),
  });
  return res.translation;
}
