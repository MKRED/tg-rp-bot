import { Spinner } from "@telegram-apps/telegram-ui";
import { motion } from "framer-motion";
import { Languages, SendHorizontal, X } from "lucide-react";
import { useRef, useState } from "react";
import { useComposeTranslate } from "../hooks/useComposeTranslate";
import type { TranslateMode } from "../api/translate-api";
import { LANG_OPTIONS } from "../lib/translate-options";
import { RpText } from "./RpText";

interface TranslateSheetProps {
  chatId: number;
  onPick: (text: string) => void;
  onClose: () => void;
}

const SHEET_T = { duration: 0.25, ease: "easeOut" as const };

const MODE_KEY = "rp-translate-mode";
const LANG_KEY = "rp-translate-lang";

/**
 * Нижняя «штора» перевода черновика сообщения. Внизу — поле исходного текста, сверху — результат
 * (клик вставляет его в инпут чата). Тумблер переключает Google ↔ ИИ; язык и режим хранятся в
 * localStorage. Управляется AnimatePresence в RpChatPage (exit-анимации играют там).
 */
export function TranslateSheet({ chatId, onPick, onClose }: TranslateSheetProps) {
  const { loading, result, error, translate, reset } = useComposeTranslate(chatId);
  const [text, setText] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Авторазмер инпута как в основном поле чата: от одной строки вверх до 160px.
  const resize = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    const borderY = el.offsetHeight - el.clientHeight;
    el.style.height = `${Math.min(el.scrollHeight + borderY, 160)}px`;
  };
  const [mode, setMode] = useState<TranslateMode>(
    () => (localStorage.getItem(MODE_KEY) === "ai" ? "ai" : "google"),
  );
  const [targetLang, setTargetLang] = useState(
    () => localStorage.getItem(LANG_KEY) ?? "en",
  );

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
      className="impersonate-sheet__backdrop"
      onClick={onClose}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={SHEET_T}
    >
      <motion.div
        className="impersonate-sheet translate-sheet"
        onClick={(e) => e.stopPropagation()}
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={SHEET_T}
      >
        <div className="impersonate-sheet__header">
          <span className="impersonate-sheet__title">Перевод</span>
          <button
            className="impersonate-sheet__close"
            onClick={onClose}
            type="button"
            aria-label="Закрыть"
          >
            <X size={20} />
          </button>
        </div>

        <div className="translate-sheet__controls">
          {/* Сегмент-переключатель: подсветка-«таблетка» скользит между Google и ИИ (layoutId) */}
          <div className="translate-sheet__mode" role="tablist">
            {(["google", "ai"] as const).map((m) => (
              <button
                key={m}
                type="button"
                role="tab"
                aria-selected={mode === m}
                className={`translate-sheet__mode-btn${mode === m ? " is-active" : ""}`}
                onClick={() => setModePersist(m)}
              >
                {mode === m && (
                  <motion.span
                    layoutId="translate-mode-thumb"
                    className="translate-sheet__mode-thumb"
                    transition={{ type: "spring", stiffness: 400, damping: 32 }}
                  />
                )}
                <span className="translate-sheet__mode-btn-label">
                  {m === "ai" ? "ИИ" : "Google"}
                </span>
              </button>
            ))}
          </div>
          <select
            className="translate-sheet__lang"
            value={targetLang}
            onChange={(e) => setLangPersist(e.target.value)}
            aria-label="Язык перевода"
          >
            {LANG_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        {/* Результат сверху: клик вставляет перевод в поле ввода чата. */}
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
            className="chat-input__textarea"
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              if (result || error) reset();
              resize();
            }}
            placeholder="Текст для перевода…"
            rows={1}
          />
          <button
            className="chat-input__send"
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
