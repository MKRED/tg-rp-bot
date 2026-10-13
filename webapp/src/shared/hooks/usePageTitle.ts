import { useEffect } from "react";

/** Имя приложения во вкладке — совпадает с <title> в index.html (до первого рендера экрана). */
export const APP_TITLE = "RP";

/** Заголовок вкладки: «Экран · RP»; без названия экрана — просто имя приложения. */
export function formatPageTitle(title?: string | null): string {
  const trimmed = title?.trim();
  return trimmed ? `${trimmed} · ${APP_TITLE}` : APP_TITLE;
}

/**
 * Ставит заголовок вкладки браузера для текущего экрана. Вызывается из каркасов экрана
 * (AppPage / FullHeightPage), а не из каждой страницы. Сбрасывать при размонтировании не нужно:
 * следующий экран монтируется после ухода старого (AnimatePresence mode="wait") и ставит свой.
 */
export function usePageTitle(title?: string | null): void {
  useEffect(() => {
    document.title = formatPageTitle(title);
  }, [title]);
}
