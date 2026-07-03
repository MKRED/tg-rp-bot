import { Spinner } from "@telegram-apps/telegram-ui";
import { motion } from "framer-motion";
import { Languages, SendHorizontal, X } from "lucide-react";
import { useLayoutEffect, useRef, useState } from "react";
import { LangPicker, type LangOption } from "./LangPicker";
import { RpText } from "./RpText";
import { useComposeTranslate, type ComposeTranslateParams } from "../hooks/useComposeTranslate";
import "./TranslateSheet.css";

/** Режим перевода черновика: обычный Google Translate либо запрос к нейросети. */
export type TranslateMode = "google" | "ai";

interface TranslateSheetProps {
  /** Функция перевода черновика (RP → /chats/:id, narrator → /stories/:id). */
  translate: (params: ComposeTranslateParams) => Promise<string>;
  /** Список языков для пикера (LANG_OPTIONS вызывающей фичи). */
  langOptions: LangOption[];
  /** Текст исходного поля — хранится у вызывающей страницы, чтобы не пропадать при закрытии шторы. */
  text: string;
  onTextChange: (text: string) => void;
  onPick: (text: string) => void;
  onClose: () => void;
}

const SHEET_T = { duration: 0.25, ease: "easeOut" as const };

const MODE_KEY = "translate-mode";
const LANG_KEY = "translate-lang";

/**
 * Нижняя «штора» перевода черновика сообщения. Внизу — поле исходного текста, сверху — результат
 * (клик вставляет его в инпут). Тумблер переключает Google ↔ ИИ; язык и режим хранятся в
 * localStorage. Управляется AnimatePresence у вызывающей страницы (exit-анимации играют там).
 */
export function TranslateSheet({
  translate: translateFn,
  langOptions,
  text,
  onTextChange,
  onPick,
  onClose,
}: TranslateSheetProps) {
  const { loading, result, error, translate, reset } = useComposeTranslate(translateFn);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Авторазмер инпута как в основном поле чата, но потолок — 5 строк (дальше внутренний скролл).
  const resize = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    const cs = getComputedStyle(el);
    const lineHeight = parseFloat(cs.lineHeight) || 21;
    const padY = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);
    const borderY = el.offsetHeight - el.clientHeight;
    const max = lineHeight * 5 + padY + borderY;
    el.style.height = `${Math.min(el.scrollHeight + borderY, max)}px`;
  };
  // Восстанавливаем высоту поля при повторном открытии шторы с сохранённым черновиком.
  useLayoutEffect(() => {
    resize();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [mode, setMode] = useState<TranslateMode>(
    () => (localStorage.getItem(MODE_KEY) === "ai" ? "ai" : "google"),
  );
  const [targetLang, setTargetLang] = useState(
    () => localStorage.getItem(LANG_KEY) ?? "en",
  );

  // Геометрия скользящей подсветки считается по реальной ширине активной кнопки (Google шире ИИ),
  // чтобы таблетка точно перекрывала сегмент. Измеряем offsetLeft/offsetWidth — они привязаны к
  // контейнеру и НЕ меняются, когда штора растёт вверх от появления результата (в отличие от
  // layout-проекции framer, которая мерила позицию во вьюпорте и дёргала таблетку по вертикали).
  const btnRefs = useRef<Record<TranslateMode, HTMLButtonElement | null>>({
    google: null,
    ai: null,
  });
  const [thumb, setThumb] = useState<{ left: number; width: number } | null>(null);

  useLayoutEffect(() => {
    const el = btnRefs.current[mode];
    if (el) setThumb({ left: el.offsetLeft, width: el.offsetWidth });
  }, [mode]);

  const setModePersist = (m: TranslateMode) => {
    setMode(m);
    localStorage.setItem(MODE_KEY, m);
  };
  const setLangPersist = (l: string) => {
    setTargetLang(l);
    localStorage.setItem(LANG_KEY, l);
  };

  const run = () => {
    if (loading || !text.trim()) return;
    translate({ text: text.trim(), targetLang, mode });
  };

  return (
    <motion.div
      className="translate-sheet__backdrop"
      onClick={onClose}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={SHEET_T}
    >
      <motion.div
        className="translate-sheet"
        onClick={(e) => e.stopPropagation()}
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={SHEET_T}
      >
        <div className="translate-sheet__header">
          <span className="translate-sheet__title">Перевод</span>
          <button
            className="translate-sheet__close"
            onClick={onClose}
            type="button"
            aria-label="Закрыть"
          >
            <X size={20} />
          </button>
        </div>

        <div className="translate-sheet__controls">
          {/* Сегмент-переключатель Google ↔ ИИ. Таблетка позиционируется по измеренной геометрии
              активной кнопки (left/width), а не layout-проекцией — поэтому рефлоу шторы её не дёргает. */}
          <div className="translate-sheet__mode" role="tablist">
            {thumb && (
              <motion.span
                aria-hidden
                className="translate-sheet__mode-thumb"
                initial={false}
                animate={{ left: thumb.left, width: thumb.width }}
                transition={{ type: "spring", stiffness: 400, damping: 32 }}
              />
            )}
            {(["google", "ai"] as const).map((m) => (
              <button
                key={m}
                ref={(el) => {
                  btnRefs.current[m] = el;
                }}
                type="button"
                role="tab"
                aria-selected={mode === m}
                className={`translate-sheet__mode-btn${mode === m ? " is-active" : ""}`}
                onClick={() => setModePersist(m)}
              >
                <span className="translate-sheet__mode-btn-label">
                  {m === "ai" ? "ИИ" : "Google"}
                </span>
              </button>
            ))}
          </div>
          <LangPicker value={targetLang} onChange={setLangPersist} options={langOptions} />
        </div>

        {/* Результат сверху: клик вставляет перевод в поле ввода. */}
        <div className="translate-sheet__result">
          {loading ? (
            <div className="translate-sheet__placeholder">
              <Spinner size="m" />
            </div>
          ) : error ? (
            <div className="translate-sheet__placeholder translate-sheet__placeholder--error">
              {error}
            </div>
          ) : result ? (
            <div className="translate-sheet__card" onClick={() => onPick(result)}>
              <p className="translate-sheet__card-text">
                <RpText text={result} />
              </p>
              <span className="translate-sheet__card-hint">Нажмите, чтобы вставить в сообщение</span>
            </div>
          ) : (
            <div className="translate-sheet__placeholder">
              <Languages size={28} strokeWidth={1.5} />
              <span>Введите текст ниже и нажмите отправить</span>
            </div>
          )}
        </div>

        <div className="translate-sheet__input">
          <textarea
            ref={textareaRef}
            className="translate-sheet__textarea"
            value={text}
            onChange={(e) => {
              onTextChange(e.target.value);
              if (result || error) reset();
              resize();
            }}
            placeholder="Текст для перевода…"
            rows={1}
          />
          <button
            className="translate-sheet__send"
            onClick={run}
            disabled={loading || !text.trim()}
            type="button"
            aria-label="Перевести"
          >
            {loading ? <Spinner size="s" /> : <SendHorizontal size={24} />}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
