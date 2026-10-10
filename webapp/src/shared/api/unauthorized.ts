/**
 * Сигнал «сессия недействительна» от API-слоя к AuthGate: apiFetch и SSE-ридеры ничего не знают о
 * React, поэтому сообщают через подписку, а gate переключается на экран входа.
 */
type Listener = () => void;
const listeners = new Set<Listener>();

export function onUnauthorized(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function notifyUnauthorized(): void {
  for (const listener of listeners) listener();
}
