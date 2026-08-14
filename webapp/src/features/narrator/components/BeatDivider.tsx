import { Caption } from "@telegram-apps/telegram-ui";

/**
 * Декоративный «разрыв сцены» между битами, сгенерированными подряд (continue без директивы).
 * Без директивы нет чипа-режиссёра, и два бита сливались бы — орнамент отмечает границу.
 */
export function BeatDivider() {
  return (
    <div
      aria-hidden
      style={{
        alignSelf: "center",
        margin: "10px 0",
        color: "var(--tgui--hint_color)",
        letterSpacing: "0.6em",
        whiteSpace: "nowrap",
        userSelect: "none",
        opacity: 0.7,
      }}
    >
      {/* отрицательный отступ компенсирует letter-spacing после последнего символа — чтобы орнамент стоял ровно по центру */}
      <Caption level="1" Component="span" style={{ marginRight: "-0.6em" }}>
        ✦ ✦ ✦
      </Caption>
    </div>
  );
}
