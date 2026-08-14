import { Caption, Spinner, Subheadline, Text } from "@telegram-apps/telegram-ui";
import { motion } from "framer-motion";
import { Eraser, Languages, SendHorizontal, X } from "lucide-react";
import { useLayoutEffect, useRef, useState } from "react";
import { LangPicker, type LangOption } from "../LangPicker";
import { RpText } from "../RpText";
import { SegmentedToggle } from "../SegmentedToggle";
import { useComposeTranslate, type ComposeTranslateParams } from "../../hooks/useComposeTranslate";
import "./TranslateSheet.css";

/** Режим перевода черновика: обычный Google Translate либо запрос к нейросети. */
export type TranslateMode = "google" | "ai";

interface TranslateSheetProps {
  /** Функция перевода черновика (RP → /chats/:id, narrator → /stories/:id). */
  translate: (params: ComposeTranslateParams) => Promise<string>;
  /** Список языков для пикера (LANG_OPTIONS вызывающей фичи). */
  langOptions: LangOption[];
  onPick: (text: string) => void;
  onClose: () => void;
}

const SHEET_T = { duration: 0.25, ease: "easeOut" as const };

const MODE_KEY = "translate-mode";
const LANG_KEY = "translate-lang";
// Единый черновик поля ввода на все чаты/истории (не привязан к конкретному чату).
const DRAFT_KEY = "translate-draft-text";

const MODE_OPTIONS = [
  { value: "google", label: "Google" },
  { value: "ai", label: "ИИ" },
] as const satisfies { value: TranslateMode; label: string }[];

/**
 * Нижняя «штора» перевода черновика сообщения. Внизу — поле исходного текста, сверху — результат
 * (клик вставляет его в инпут). Тумблер переключает Google ↔ ИИ; режим, язык и сам текст поля
 * хранятся в localStorage — единый черновик на все чаты/истории, а не свой на каждый.
 * Управляется AnimatePresence у вызывающей страницы (exit-анимации играют там).
 */
export function TranslateSheet({
  translate: translateFn,
  langOptions,
  onPick,
  onClose,
}: TranslateSheetProps) {
  const { loading, result, error, translate, reset } = useComposeTranslate(translateFn);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  // Черновик поля ввода — один общий на все чаты/истории, переживает закрытие шторы и перезагрузку.
  const [text, setText] = useState(() => localStorage.getItem(DRAFT_KEY) ?? "");

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
  // Пересчитываем высоту при любом изменении текста (ввод, очистка, восстановление черновика при
  // открытии шторы) — именно после рендера, когда DOM textarea уже отражает актуальное value.
  // Дёргать resize() прямо в обработчике клика (напр. в clearText) нельзя: setState применяется
  // асинхронно, и el.value/scrollHeight там ещё старые.
  useLayoutEffect(() => {
    resize();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);
  const [mode, setMode] = useState<TranslateMode>(
    () => (localStorage.getItem(MODE_KEY) === "ai" ? "ai" : "google"),
  );
  const [targetLang, setTargetLang] = useState(
    () => localStorage.getItem(LANG_KEY) ?? "en",
  );

  const changeText = (t: string) => {
    setText(t);
    localStorage.setItem(DRAFT_KEY, t);
  };
  const clearText = () => {
    changeText("");
    if (result || error) reset();
  };
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
          <Subheadline level="1" weight="2" Component="span" className="translate-sheet__title">Перевод</Subheadline>
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
          <SegmentedToggle options={MODE_OPTIONS} value={mode} onChange={setModePersist} />
          <button
            className="translate-sheet__clear"
            onClick={clearText}
            disabled={!text}
            type="button"
            aria-label="Очистить поле ввода"
          >
            <Eraser size={18} />
          </button>
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
              <Text>{error}</Text>
            </div>
          ) : result ? (
            <div className="translate-sheet__card" onClick={() => onPick(result)}>
              <Text Component="p" className="translate-sheet__card-text">
                <RpText text={result} />
              </Text>
              <Caption level="2" weight="2" Component="span" className="translate-sheet__card-hint">
                Нажмите, чтобы вставить в сообщение
              </Caption>
            </div>
          ) : (
            <div className="translate-sheet__placeholder">
              <Languages size={28} strokeWidth={1.5} />
              <Text>Введите текст ниже и нажмите отправить</Text>
            </div>
          )}
        </div>

        <div className="translate-sheet__input">
          <textarea
            ref={textareaRef}
            className="translate-sheet__textarea"
            value={text}
            onChange={(e) => {
              changeText(e.target.value);
              if (result || error) reset();
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
