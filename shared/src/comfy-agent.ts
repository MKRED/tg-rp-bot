// Контракт /api/comfy-agent — подключение своего ComfyUI через агента на ПК пользователя.
// Агент сам ходит на сервер (long-poll), поэтому браузеру не нужен прямой доступ к ComfyUI.

/** Статус агента для экрана подключения. */
export interface ComfyAgentStatus {
  /** Токен выпущен (сам токен сервер хранит только в виде хеша и не отдаёт). */
  hasToken: boolean;
  /** Агент сейчас держит соединение или выходил на связь только что. */
  online: boolean;
  /** Когда агент последний раз выходил на связь (ISO), null — ни разу с запуска сервера. */
  lastSeenAt: string | null;
}

/**
 * Одноразовый код для команды установки агента. Токен агента в команду не попадает: его выпускает
 * сервер в момент установки, поэтому код в логах или истории PowerShell после использования бесполезен.
 */
export interface ComfyAgentInstallCode {
  code: string;
  /** До какого момента (ISO) код можно использовать. */
  expiresAt: string;
}

/** Коды ошибок цепочки «сервер → агент → ComfyUI» (поле `error` тела ответа). */
export type ComfyAgentErrorCode =
  | "comfy_agent_offline"
  | "comfy_agent_timeout"
  | "comfy_unreachable"
  | "comfy_error";

/** Модели, которые умеет запускать приложение. */
export type ComfyModelId = "qwen" | "qwen_turbo";

/** Готовность одной модели: чего не хватает в ComfyUI пользователя. */
export interface ComfyModelReadiness {
  id: ComfyModelId;
  label: string;
  ready: boolean;
  /** Ноды (class_type), которых нет в ComfyUI: нужно обновить ComfyUI или поставить расширение. */
  missingNodes: string[];
  /** Файлы моделей, которых нет в соответствующей папке ComfyUI. */
  missingFiles: { folder: string; file: string }[];
}

/** Результат проверки ComfyUI пользователя. */
export interface ComfyReadiness {
  comfyuiVersion: string | null;
  /** Видеокарта, на которой работает ComfyUI; null — ComfyUI не сообщил (например, работает на CPU). */
  gpu: { name: string; vramTotalBytes: number; vramFreeBytes: number } | null;
  models: ComfyModelReadiness[];
}
