/*
  Шрифты приложения — единственное место, где задаются семейства. Компоненты и CSS-модули шрифт не
  указывают, только var(--mantine-font-family) / var(--mantine-font-family-headings).

  Пар «текст + заголовки» несколько — пользователь выбирает в настройках (ThemeProvider, FontPicker).
  Стили Google Fonts подключаются из JS только для выбранной пары (loadFontPair) — не грузим шрифты,
  которыми не пользуются. Кириллица есть у всех: css2 отдаёт @font-face по unicode-range, браузер
  качает только нужные наборы. Добавить пару = объект в FONT_PAIRS (families — параметры family=
  из ссылки Google Fonts).
*/

/** Системный стек, как у нативного Telegram: SF на Apple, Roboto на Android, Segoe UI на Windows. Он же фоллбэк. */
const SYSTEM_STACK = 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
const SERIF_FALLBACK = 'Georgia, "Times New Roman", serif';

export interface FontPair {
  label: string;
  body: string;
  headings: string;
  /** family-параметры Google Fonts css2; пусто — системный шрифт, грузить нечего. */
  families: string[];
}

export const FONT_PAIRS = {
  system: { label: "Системный", body: SYSTEM_STACK, headings: SYSTEM_STACK, families: [] },
  manropeLora: {
    label: "Manrope + Lora",
    body: `Manrope, ${SYSTEM_STACK}`,
    headings: `Lora, ${SERIF_FALLBACK}`,
    families: ["Manrope:wght@400;500;600;700", "Lora:wght@500;600;700"],
  },
  onest: {
    label: "Onest",
    body: `Onest, ${SYSTEM_STACK}`,
    headings: `Onest, ${SYSTEM_STACK}`,
    families: ["Onest:wght@400;500;600;700"],
  },
} satisfies Record<string, FontPair>;

export type FontPairId = keyof typeof FONT_PAIRS;

/** Пара по умолчанию — пока пользователь не выбрал свою. */
export const DEFAULT_FONT_PAIR: FontPairId = "manropeLora";

/**
 * Подключает стили Google Fonts пары (один <link> на пару, повторный вызов ничего не делает).
 * display=swap: пока шрифт качается, текст виден системным шрифтом, а не пропадает. Google Fonts
 * недоступен (блокировка, сеть) — остаётся системный фоллбэк; <link> удаляем, чтобы следующий вызов
 * попробовал снова.
 */
export function loadFontPair(id: FontPairId): void {
  const { families } = FONT_PAIRS[id] as FontPair;
  if (families.length === 0) return;
  const linkId = `font-pair-${id}`;
  if (document.getElementById(linkId)) return;
  const link = document.createElement("link");
  link.id = linkId;
  link.rel = "stylesheet";
  link.href = `https://fonts.googleapis.com/css2?${families.map((f) => `family=${f}`).join("&")}&display=swap`;
  link.onerror = () => {
    console.warn(`Не удалось загрузить шрифты «${FONT_PAIRS[id].label}» — остаётся системный`);
    link.remove();
  };
  document.head.appendChild(link);
}
