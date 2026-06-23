import { createContext } from "react";

/** Тип уведомления — задаёт иконку и цвет акцента. */
export type ToastType = "success" | "error";

export interface ToastOptions {
  /** Текст уведомления. */
  message: string;
  /** Тип (по умолчанию success). */
  type?: ToastType;
  /** Время до автозакрытия, мс (по умолчанию задаёт провайдер). */
  duration?: number;
}

export interface ToastContextValue {
  /** Показать уведомление. Новое вытесняет предыдущее. */
  showToast: (opts: ToastOptions) => void;
}

/** Контекст тостов. null вне ToastProvider — useToast тогда бросает понятную ошибку. */
export const ToastContext = createContext<ToastContextValue | null>(null);
