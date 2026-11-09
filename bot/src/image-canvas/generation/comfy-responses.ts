/** Разбор ответов ComfyUI (history, queue, prompt) — чистые функции, форматы ComfyUI 0.4x. */

export interface OutputImage {
  filename: string;
  subfolder: string;
  type: string;
}

export type HistoryState =
  | { state: "pending" }
  | { state: "done"; images: OutputImage[] }
  | { state: "error"; message: string; interrupted: boolean };

interface HistoryEntry {
  status?: { status_str?: string; completed?: boolean; messages?: unknown[] };
  outputs?: Record<string, { images?: unknown[] }>;
}

/**
 * Состояние задания по ответу `GET /api/history/<prompt_id>`. Пока задание в очереди или идёт,
 * ComfyUI отвечает `{}` — это "pending".
 */
export function parseHistory(body: unknown, promptId: string): HistoryState {
  const entry = (body as Record<string, HistoryEntry> | null)?.[promptId];
  if (!entry?.status) return { state: "pending" };
  const { status } = entry;
  if (status.status_str === "error") {
    const messages = Array.isArray(status.messages) ? status.messages : [];
    const interrupted = messages.some((m) => Array.isArray(m) && m[0] === "execution_interrupted");
    const failure = messages.find((m) => Array.isArray(m) && m[0] === "execution_error") as [string, Record<string, unknown>] | undefined;
    const detail = failure?.[1];
    const message = interrupted
      ? "Генерация остановлена"
      : detail
        ? `${String(detail.node_type ?? "Нода")}: ${String(detail.exception_message ?? "ошибка").trim()}`
        : "ComfyUI завершил задание с ошибкой";
    return { state: "error", message, interrupted };
  }
  if (!status.completed) return { state: "pending" };
  const images = Object.values(entry.outputs ?? {})
    .flatMap((output) => output.images ?? [])
    .filter((img): img is OutputImage => {
      const i = img as Partial<OutputImage> | null;
      return typeof i?.filename === "string" && typeof i.type === "string";
    })
    .map((img) => ({ filename: img.filename, subfolder: img.subfolder ?? "", type: img.type }));
  return { state: "done", images };
}

/** Где задание в очереди ComfyUI (`GET /api/queue`). Элемент очереди: `[номер, prompt_id, …]`. */
export function queuePosition(body: unknown, promptId: string): "running" | "pending" | "absent" {
  const queue = body as { queue_running?: unknown[]; queue_pending?: unknown[] } | null;
  const has = (list: unknown[] | undefined) => (list ?? []).some((item) => Array.isArray(item) && item[1] === promptId);
  if (has(queue?.queue_running)) return "running";
  if (has(queue?.queue_pending)) return "pending";
  return "absent";
}

/**
 * Понятный текст отказа `POST /api/prompt` (400): `{ error: { message }, node_errors: { id: { class_type,
 * errors: [{ message, details }] } } }`.
 */
export function promptRejection(body: unknown): string {
  const parsed = body as { error?: { message?: string }; node_errors?: Record<string, { class_type?: string; errors?: Array<{ message?: string; details?: string }> }> } | null;
  const nodeError = Object.values(parsed?.node_errors ?? {})[0];
  const first = nodeError?.errors?.[0];
  if (nodeError && first) {
    return `${nodeError.class_type ?? "Нода"}: ${[first.message, first.details].filter(Boolean).join(" — ")}`;
  }
  return parsed?.error?.message ?? "ComfyUI отклонил задание";
}
