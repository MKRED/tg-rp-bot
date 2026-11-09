import { apiFetch } from "../../../shared/api/client";
import type { ComfyAgentInstallCode, ComfyAgentStatus, ComfyReadiness } from "../types/comfyAgent";

/** Подключён ли агент на ПК и выходил ли он на связь. */
export function getComfyAgentStatus(): Promise<ComfyAgentStatus> {
  return apiFetch<ComfyAgentStatus>("/comfy-agent");
}

/** Одноразовый код для команды установки агента. Текущий агент продолжает работать до установки. */
export function createInstallCode(): Promise<ComfyAgentInstallCode> {
  return apiFetch<ComfyAgentInstallCode>("/comfy-agent/install-code", { method: "POST", body: "{}" });
}

/** Отключить ПК: токен агента удаляется, агент останавливается. */
export function disconnectComfyAgent(): Promise<{ ok: true }> {
  return apiFetch<{ ok: true }>("/comfy-agent/token", { method: "DELETE" });
}

/** Проверка ComfyUI через агента: версия, видеокарта, ноды и файлы моделей. */
export function checkComfy(): Promise<ComfyReadiness> {
  return apiFetch<ComfyReadiness>("/comfy-agent/check");
}
