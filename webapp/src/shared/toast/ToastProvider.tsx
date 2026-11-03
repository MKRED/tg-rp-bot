import { Notifications, notifications } from "@mantine/notifications";
import { Check, Hourglass, X } from "lucide-react";
import { type ReactNode, useCallback, useMemo } from "react";
import { type ToastOptions, ToastContext } from "./context";
import styles from "./Toast.module.css";

const DEFAULT_DURATION_MS = 2500;
// Выше оверлея лайтбокса (9999) — тост виден и поверх него.
const TOAST_Z_INDEX = 10000;

/**
 * Провайдер переиспользуемых уведомлений (тостов) поверх @mantine/notifications. Любой потомок через
 * useToast() показывает краткое сообщение внизу экрана. Держим один активный тост: новый вытесняет
 * предыдущий (clean перед show, limit={1} на случай гонки).
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const showToast = useCallback((opts: ToastOptions) => {
    const type = opts.type ?? "success";
    notifications.clean();
    notifications.show({
      message: opts.message,
      color: type === "error" ? "red" : type === "info" ? "accent" : "teal",
      icon: type === "error" ? <X size={16} /> : type === "info" ? <Hourglass size={16} /> : <Check size={16} />,
      autoClose: opts.duration ?? DEFAULT_DURATION_MS,
      withBorder: true,
    });
  }, []);

  const value = useMemo(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={value}>
      <Notifications position="bottom-center" limit={1} zIndex={TOAST_Z_INDEX} classNames={{ root: styles.root }} />
      {children}
    </ToastContext.Provider>
  );
}
