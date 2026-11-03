import { Fragment } from "react";

/**
 * Текст ответа ИИ: модель выделяет главное **жирным** — показываем выделение, а не звёздочки.
 * Остальную разметку не разбираем: ответы короткие, переносы сохраняет white-space.
 */
export function FeedText({ text }: { text: string }) {
  const parts = text.split(/\*\*(.+?)\*\*/g);
  return (
    <>
      {parts.map((part, i) => (i % 2 === 1 ? <b key={i}>{part}</b> : <Fragment key={i}>{part}</Fragment>))}
    </>
  );
}
