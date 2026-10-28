/** CSS-переменная с видимой высотой окна — её читают экраны на всю высоту (FullHeightPage, редактор промпта). */
export const VIEWPORT_HEIGHT_VAR = "--app-viewport-height";

/**
 * Держит `--app-viewport-height` равной высоте visualViewport — видимой части окна без экранной клавиатуры.
 *
 * Зачем: мобильные браузеры по умолчанию кладут клавиатуру поверх страницы, не уменьшая 100dvh, и поле
 * ввода внизу экрана чата уезжает под неё. В Chrome на Android это лечит `interactive-widget=resizes-content`
 * в meta viewport (index.html), но Safari на iPhone его не знает — там высоту даёт только visualViewport.
 * В Telegram и на десктопе visualViewport совпадает с окном, поведение не меняется.
 * Без visualViewport (старые браузеры) переменная не ставится — CSS берёт запасное 100dvh.
 */
export function bindVisualViewportHeight(): void {
  const vv = window.visualViewport;
  if (!vv) return;
  const root = document.documentElement;
  const apply = () => root.style.setProperty(VIEWPORT_HEIGHT_VAR, `${Math.round(vv.height)}px`);
  apply();
  vv.addEventListener("resize", apply);
}
