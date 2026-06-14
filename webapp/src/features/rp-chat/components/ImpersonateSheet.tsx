import { Spinner } from "@telegram-apps/telegram-ui";
import { motion } from "framer-motion";
import { Sparkles, X } from "lucide-react";
import { useEffect, useRef } from "react";
import { useImpersonate } from "../hooks/useImpersonate";
import { ImpersonateVariantCard } from "./ImpersonateVariantCard";
import { RpText } from "./RpText";

interface ImpersonateSheetProps {
  chatId: number;
  /** Язык перевода из настроек чата (для кнопок перевода на карточках). */
  targetLang: string;
  onPick: (text: string) => void;
  onClose: () => void;
}

const SHEET_T = { duration: 0.25, ease: "easeOut" as const };

/**
 * Нижняя «штора» с вариантами реплик от лица пользователя. Управляется AnimatePresence
 * в RpChatPage (монтируется/размонтируется по impersonateOpen) — exit-анимации играют там.
 */
export function ImpersonateSheet({ chatId, targetLang, onPick, onClose }: ImpersonateSheetProps) {
  const { variants, generating, streamingText, load, generate } = useImpersonate(chatId);
  const listEndRef = useRef<HTMLDivElement>(null);

  // load стабилен (deps [chatId]) → эффект выполняется один раз за открытие шторы.
  useEffect(() => {
    load();
  }, [load]);

  // Держим прокрутку у низа: новые варианты и текущая генерация — снизу.
  useEffect(() => {
    listEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [variants.length, streamingText, generating]);

  return (
    // Корень — backdrop (один keyed motion-элемент для AnimatePresence в RpChatPage);
    // панель вложена, её y-exit играет вместе с exit'ом родителя.
    <motion.div
      className="impersonate-sheet__backdrop"
      onClick={onClose}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={SHEET_T}
    >
      <motion.div
        className="impersonate-sheet"
        onClick={(e) => e.stopPropagation()}
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={SHEET_T}
      >
        <div className="impersonate-sheet__header">
          <span className="impersonate-sheet__title">Ответ от вашего лица</span>
          <button
            className="impersonate-sheet__close"
            onClick={onClose}
            type="button"
            aria-label="Закрыть"
          >
            <X size={20} />
          </button>
        </div>

        <div className="impersonate-sheet__list">
          {variants.map((v) => (
            <ImpersonateVariantCard
              key={v.id}
              chatId={chatId}
              text={v.content}
              targetLang={targetLang}
              onPick={onPick}
            />
          ))}

          {/* Текущая генерация — снизу, как самый новый вариант. */}
          {generating && (
            <div className="impersonate-sheet__streaming">
              {streamingText ? (
                <p className="impersonate-card__text"><RpText text={streamingText} /></p>
              ) : (
                <Spinner size="s" />
              )}
            </div>
          )}

          {!generating && variants.length === 0 && (
            <div className="impersonate-sheet__empty">Нет вариантов</div>
          )}

          <div ref={listEndRef} />
        </div>

        <button
          className="impersonate-sheet__more"
          onClick={generate}
          disabled={generating}
          type="button"
        >
          {generating ? <Spinner size="s" /> : (<><Sparkles size={16} /> Сгенерировать ещё</>)}
        </button>
      </motion.div>
    </motion.div>
  );
}
