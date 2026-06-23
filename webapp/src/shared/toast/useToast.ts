import { useContext } from "react";
import { ToastContext } from "./context";

/** Доступ к показу тостов. Бросает, если вызван вне ToastProvider — это ошибка разработки. */
export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}
