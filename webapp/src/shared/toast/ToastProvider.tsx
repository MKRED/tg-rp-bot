import { Snackbar } from "@telegram-apps/telegram-ui";
import { type ReactNode, useCallback, useMemo, useState } from "react";
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
      {/* Snackbar сам портирует себя через tgui RootRenderer в контейнер <AppRoot> (не в наш JSX),
          поэтому свой портал-обёртку не делаем — она бы всё равно осталась пустой. Класс
          toast-snackbar поднимает z-index выше лайтбокса (9999): сам Snackbar — position:fixed без
          z-index, а ни один его предок (AppRoot/#root/body/html) не образует stacking context, так
          что z-index:10000 на нём конкурирует в корневом контексте и перекрывает оверлей лайтбокса. */}
      {toast && (
        <Snackbar
          key={toast.id}
          className="toast-snackbar"
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
      )}
    </ToastContext.Provider>
  );
}
