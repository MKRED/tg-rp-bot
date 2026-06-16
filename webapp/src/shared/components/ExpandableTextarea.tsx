import { Textarea } from "@telegram-apps/telegram-ui";
import { type ComponentProps, useEffect, useRef, useState } from "react";
import "./ExpandableTextarea.css";

type TextareaProps = ComponentProps<typeof Textarea>;

interface ExpandableTextareaProps extends TextareaProps {
  /** Базовое (свёрнутое) число строк. */
  rows?: number;
  /** Во сколько раз увеличивается высота при разворачивании. */
  expandFactor?: number;
}

/**
 * Textarea с кнопкой «развернуть/свернуть»: по умолчанию показывает `rows` строк,
 * по клику плавно растягивается в `expandFactor` раз и так же схлопывается обратно.
 *
 * Анимируем высоту через CSS-transition на самом textarea (height ставим инлайн в px).
 * Свёрнутую высоту (по rows) меряем один раз и кэшируем — она не зависит от контента,
 * т.к. при resize:none textarea со фиксированным rows скроллит, а не растёт.
 */
export function ExpandableTextarea({ rows = 6, expandFactor = 3, ...props }: ExpandableTextareaProps) {
  const taRef = useRef<HTMLTextAreaElement>(null);
  const naturalRef = useRef<number | null>(null);
  const [expanded, setExpanded] = useState(false);

  // Кэш свёрнутой высоты привязан к rows: если базовое число строк сменилось — пересчитать.
  useEffect(() => {
    naturalRef.current = null;
  }, [rows]);

  const toggle = () => {
    const ta = taRef.current;
    if (!ta) {
      setExpanded((v) => !v);
      return;
    }
    // Высоту свёрнутого состояния (по rows) фиксируем при первом разворачивании.
    if (naturalRef.current == null) naturalRef.current = ta.clientHeight;
    const natural = naturalRef.current;

    // box-sizing: border-box (глобальный reset) → height учитывает padding, поэтому
    // целевую высоту считаем как «контент × factor + вертикальный padding».
    const cs = getComputedStyle(ta);
    const padV = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);
    const target = expanded ? natural : (natural - padV) * expandFactor + padV;

    const from = ta.clientHeight;
    ta.style.height = `${from}px`;
    void ta.offsetHeight; // принудительный reflow: фиксируем стартовую высоту до запуска transition
    ta.style.height = `${target}px`;
    setExpanded((v) => !v);
  };

  return (
    <div className={`expandable-textarea${expanded ? " expandable-textarea--expanded" : ""}`}>
      <Textarea ref={taRef} rows={rows} {...props} />
      <button
        type="button"
        className="expandable-textarea__toggle"
        aria-label={expanded ? "Свернуть" : "Развернуть"}
        aria-expanded={expanded}
        onClick={toggle}
      >
        <svg
          className="expandable-textarea__icon"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
    </div>
  );
}
