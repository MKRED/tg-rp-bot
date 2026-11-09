import type { ComfyMethod } from "../comfy-paths.js";

/** Запрос к ComfyUI, который агент выполнит у себя на 127.0.0.1. */
export interface AgentJobRequest {
  method: ComfyMethod;
  /** Путь ComfyUI с префиксом /api, без query. */
  path: string;
  query?: Record<string, string>;
  /** Тело для POST как есть, в base64: агент передаёт байты без разбора (JSON, позже multipart). */
  bodyBase64?: string;
  contentType?: string;
}

export interface AgentJob extends AgentJobRequest {
  id: string;
}

/** Ответ агента. status 0 и error — до ComfyUI достучаться не удалось. */
export interface AgentResponse {
  status: number;
  contentType: string | null;
  /** Тело ответа ComfyUI в base64: так одинаково передаются и JSON, и картинки. */
  bodyBase64: string;
  error?: string;
}

export interface RelayHubOptions {
  /** Сколько держать long-poll без заданий (меньше таймаута nginx). */
  pollHoldMs: number;
  /** Сколько после последнего выхода на связь агент считается онлайн. */
  onlineWindowMs: number;
  /** Сколько ждать ответ агента на задание по умолчанию. */
  jobTimeoutMs: number;
  now?: () => number;
}
