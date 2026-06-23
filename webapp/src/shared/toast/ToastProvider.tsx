import { Snackbar } from "@telegram-apps/telegram-ui";
import { type ReactNode, useCallback, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { type ToastOptions, ToastContext } from "./context";
import "./Toast.css";

interface ToastState extends ToastOptions {
  /** Уникальный ключ — заставляет Snackbar перемонтироваться при быстрой смене тостов. */
  id: number;
}

const DEFAULT_DURATION_MS = 2500;

/**
 * Провайдер переиспользуемых уведомлений (тостов). Любой потомок через useToast() показывает
 * краткое сообщение внизу экрана (tgui Snackbar) — например, результат отправки фото в чат.
 * Держим один активный тост: новый вытесняет предыдущий (id меняет key → чистый перезапуск таймера).
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastState | null>(null);

  const showToast = useCallback((opts: ToastOptions) => {
    setToast({ id: Date.now(), ...opts });
  }, []);

  const value = useMemo(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {/* Портал в body со своим слоем выше лайтбокса (z-index 9999): иначе Snackbar (z-index tgui ~1)
          рисуется ПОД тёмным оверлеем — а тост нужен как раз для фидбека из лайтбокса. Слой не ловит
          тапы (pointer-events:none), кликабелен только сам Snackbar. */}
      {toast &&
        createPortal(
          <div className="toast-layer">
            <Snackbar
              key={toast.id}
              duration={toast.duration ?? DEFAULT_DURATION_MS}
              onClose={() => setToast(null)}
              before={
                <span className={`toast__icon toast__icon--${toast.type ?? "success"}`} aria-hidden>
                  {toast.type === "error" ? "✕" : "✓"}
                </span>
              }
            >
              {toast.message}
            </Snackbar>
          </div>,
          document.body,
        )}
    </ToastContext.Provider>
  );
}
