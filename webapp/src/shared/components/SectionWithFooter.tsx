import { Section, type SectionProps } from "@telegram-apps/telegram-ui";
import type { ReactNode } from "react";

interface SectionWithFooterProps extends Omit<SectionProps, "footer"> {
  footer: ReactNode;
}

/**
 * Section tgui с текстовой заметкой внизу карточки. Не проп footer у Section — tgui рендерит его ВНЕ
 * карточки, на фоне страницы, и там он выбивается по фону; рендерим как последний ребёнок секции.
 */
export function SectionWithFooter({ footer, children, ...sectionProps }: SectionWithFooterProps) {
  return (
    <Section {...sectionProps}>
      {children}
      <p className="section-note">{footer}</p>
    </Section>
  );
}
