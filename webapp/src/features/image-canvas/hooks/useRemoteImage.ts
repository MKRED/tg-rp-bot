import { useEffect, useState } from "react";

/**
 * Кэш полных картинок (data URL ~2 МБ) на время сессии: свайп по черновикам и повторное открытие
 * варианта не качают картинку заново. Ограничен — иначе вкладка держала бы в памяти все версии.
 */
const MAX_CACHED = 12;
const cache = new Map<string, string>();
const pending = new Map<string, Promise<string>>();

function remember(key: string, src: string): void {
  cache.delete(key);
  cache.set(key, src);
  while (cache.size > MAX_CACHED) cache.delete(cache.keys().next().value!);
}

/** Забыть картинку (слот картинки заменили — по тому же ключу теперь другая). */
export function forgetRemoteImage(prefix: string): void {
  for (const key of [...cache.keys()]) if (key.startsWith(prefix)) cache.delete(key);
}

export function loadRemoteImage(key: string, load: () => Promise<string>): Promise<string> {
  const cached = cache.get(key);
  if (cached) return Promise.resolve(cached);
  let promise = pending.get(key);
  if (!promise) {
    promise = load()
      .then((src) => {
        remember(key, src);
        return src;
      })
      .finally(() => pending.delete(key));
    pending.set(key, promise);
  }
  return promise;
}

/** Полная картинка по ключу; undefined — грузится (или ключа нет). */
export function useRemoteImage(key: string | null, load: () => Promise<string>): { src?: string; failed: boolean } {
  const [state, setState] = useState<{ key: string | null; src?: string; failed: boolean }>(() => ({
    key,
    src: key ? cache.get(key) : undefined,
    failed: false,
  }));

  useEffect(() => {
    if (!key) return;
    let alive = true;
    const cached = cache.get(key);
    if (cached) {
      setState({ key, src: cached, failed: false });
      return;
    }
    setState({ key, src: undefined, failed: false });
    loadRemoteImage(key, load)
      .then((src) => alive && setState({ key, src, failed: false }))
      .catch((err) => {
        console.error("Failed to load canvas image", err);
        if (alive) setState({ key, src: undefined, failed: true });
      });
    return () => {
      alive = false;
    };
    // load — новый на каждом рендере; картинку определяет только ключ.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return state.key === key ? { src: state.src, failed: state.failed } : { src: undefined, failed: false };
}
