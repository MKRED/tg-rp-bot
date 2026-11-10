import { useEffect, useRef } from "react";
import { pushBackInterceptor } from "../telegram/backInterceptor";

/** Ключ в history.state, которым оверлей помечает свою запись истории. */
const STATE_KEY = "__overlay";
let nextMark = 0;
/** Отложенные history.back() по меткам: повторный монтаж (StrictMode) отменяет возврат. */
const pendingBack = new Map<number, ReturnType<typeof setTimeout>>();

function currentMark(): unknown {
  return (window.history.state as Record<string, unknown> | null)?.[STATE_KEY];
}

/**
 * «Назад» закрывает полноэкранный оверлей (галерею, просмотр картинки), а не уводит со страницы.
 * - В Telegram — нативная кнопка «Назад» (и системная на Android, пока она показана) через pushBackInterceptor.
 * - В браузере — системная «Назад» телефона и кнопка браузера идут по истории: на время оверлея кладём в
 *   историю свою запись (тот же URL), «Назад» снимает её и закрывает оверлей. Закрыли иначе (крестик, Esc) —
 *   запись снимаем сами, чтобы следующий «Назад» не съедался впустую.
 * Запись копирует state роутера (idx, key) — для HashRouter возврат на неё не навигация.
 */
export function useOverlayBack(onClose: () => void): void {
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const mark = useRef(0);
  if (!mark.current) mark.current = ++nextMark;

  useEffect(() => pushBackInterceptor(() => closeRef.current()), []);

  useEffect(() => {
    const own = mark.current;
    const timer = pendingBack.get(own);
    if (timer !== undefined) {
      // StrictMode размонтировал и сразу смонтировал заново: запись ещё наша, снимать не нужно.
      clearTimeout(timer);
      pendingBack.delete(own);
    }
    if (currentMark() !== own) {
      window.history.pushState({ ...(window.history.state as object | null), [STATE_KEY]: own }, "");
    }
    const onPop = () => {
      if (currentMark() !== own) closeRef.current();
    };
    window.addEventListener("popstate", onPop);
    return () => {
      window.removeEventListener("popstate", onPop);
      pendingBack.set(
        own,
        setTimeout(() => {
          pendingBack.delete(own);
          // Запись снимаем, только если на ней и стоим: после навигации «Назад» увёл бы с новой страницы.
          if (currentMark() === own) window.history.back();
        }, 0),
      );
    };
  }, []);
}
