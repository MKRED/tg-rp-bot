/** Картинка галереи. Ключ — сама картинка (не позиция): по нему лента переносит уже загруженный слайд. */
export interface GalleryItem {
  key: string;
  /** Полная картинка; undefined — ещё грузится (на слайде спиннер). */
  src?: string;
  /** Миниатюра для полосы внизу; нет — полоса покажет полную картинку, когда та загрузится. */
  thumb?: string;
  /** Подпись в шапке слева («Черновик 1 · Qwen»); нет — шапка без подписи. */
  caption?: string;
}

/** Пункт меню «⋮» в шапке просмотра. */
export interface GalleryAction {
  key: string;
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}
