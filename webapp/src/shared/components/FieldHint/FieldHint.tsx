import { Caption } from "@telegram-apps/telegram-ui";
import type { CSSProperties, ReactNode } from "react";
import "./FieldHint.css";

interface FieldHintProps {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}

/** Текст подсказки под полем формы (Input/Textarea/Slider/Switch) — единый стиль везде. */
export function FieldHint({ children, className, style }: FieldHintProps) {
  const cls = className ? `field-hint ${className}` : "field-hint";
  return (
    <Caption level="1" className={cls} style={style}>
      {children}
    </Caption>
  );
}
