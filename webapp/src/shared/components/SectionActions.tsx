import type { ReactNode } from "react";
import "./SectionActions.css";

interface SectionActionsProps {
  children: ReactNode;
}

/**
 * Блок кнопок в подвале Section. В отличие от Cell/Input/Textarea, Button не несёт своего
 * горизонтального гуттера — без обёртки кнопки прижимаются к краю карточки.
 */
export function SectionActions({ children }: SectionActionsProps) {
  return <div className="section-actions">{children}</div>;
}
