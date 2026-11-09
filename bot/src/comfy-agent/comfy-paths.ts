/**
 * Белый список запросов к ComfyUI, которые сервер может передать агенту. Тот же список проверяет и
 * сам агент (tools/comfy-agent/comfy-agent.ps1): даже скомпрометированный сервер не получит через
 * агента произвольный доступ к ПК — только эти эндпоинты ComfyUI.
 */
const ALLOWED: Array<{ method: "GET" | "POST"; pattern: RegExp }> = [
  { method: "GET", pattern: /^\/api\/system_stats$/ },
  { method: "GET", pattern: /^\/api\/object_info(\/[A-Za-z0-9_.-]+)?$/ },
  { method: "GET", pattern: /^\/api\/queue$/ },
  { method: "GET", pattern: /^\/api\/history\/[A-Za-z0-9-]+$/ },
  { method: "GET", pattern: /^\/api\/view$/ },
  { method: "POST", pattern: /^\/api\/prompt$/ },
  { method: "POST", pattern: /^\/api\/upload\/image$/ },
  { method: "POST", pattern: /^\/api\/interrupt$/ },
];

export type ComfyMethod = "GET" | "POST";

export function isAllowedComfyRequest(method: string, path: string): method is ComfyMethod {
  return ALLOWED.some((rule) => rule.method === method && rule.pattern.test(path));
}
