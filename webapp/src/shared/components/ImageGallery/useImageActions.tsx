import { Download, Send, Share2 } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { sendPhotoToChat } from "../../api/sendPhoto";
import { canShareFiles, downloadFile, imageFile, makeShareable } from "../../image/share";
import { isInsideTelegram } from "../../telegram/initData";
import { useToast } from "../../toast";
import type { GalleryAction } from "./types";

/** Имя файла для «Скачать» и «Поделиться» (расширение — по типу картинки). */
const FILE_BASE_NAME = "image";

/**
 * Пункты меню «⋮» для картинки на экране — по окружению, одинаково у всех просмотров:
 * в Telegram — «Отправить в чат» (скачивание в webview не работает), в браузере — «Скачать» и
 * «Поделиться» (только если браузер делится файлами).
 *
 * Файл для браузерных пунктов готовим при открытии меню (prepare), а не по нажатию пункта: iOS
 * разрешает navigator.share только сразу в обработчике нажатия, без await перед ним.
 */
export function useImageActions(src: string | undefined) {
  const { showToast } = useToast();
  const inTelegram = useMemo(isInsideTelegram, []);
  const shareable = useMemo(() => !inTelegram && canShareFiles(), [inTelegram]);
  const [sending, setSending] = useState(false);
  const [file, setFile] = useState<{ src: string; file: File } | null>(null);
  const preparing = useRef<string | null>(null);
  const ready = file && file.src === src ? file.file : null;

  const prepare = () => {
    if (inTelegram || !src || ready || preparing.current === src) return;
    preparing.current = src;
    imageFile(src, FILE_BASE_NAME)
      .then((f) => setFile({ src, file: f }))
      .catch((err) => {
        console.error("Failed to prepare image file", err);
        showToast({ type: "error", message: "Не удалось подготовить картинку" });
      })
      .finally(() => {
        if (preparing.current === src) preparing.current = null;
      });
  };

  const send = async () => {
    if (!src || sending) return;
    setSending(true);
    try {
      await sendPhotoToChat(await makeShareable(src));
      showToast({ type: "success", message: "Отправлено в чат" });
    } catch (err) {
      console.error("Failed to send image to chat", err);
      showToast({ type: "error", message: "Не удалось отправить картинку" });
    } finally {
      setSending(false);
    }
  };

  const share = (f: File) => {
    navigator.share({ files: [f] }).catch((err: unknown) => {
      // Закрыли системное меню, ничего не выбрав, — не ошибка.
      if (err instanceof DOMException && err.name === "AbortError") return;
      console.error("Failed to share image", err);
      showToast({ type: "error", message: "Не удалось поделиться картинкой" });
    });
  };

  const actions: GalleryAction[] = inTelegram
    ? [{ key: "send", label: "Отправить в чат", icon: <Send size={16} />, disabled: !src || sending, onClick: () => void send() }]
    : [
        { key: "download", label: "Скачать", icon: <Download size={16} />, disabled: !ready, onClick: () => ready && downloadFile(ready, ready.name) },
        ...(shareable
          ? [{ key: "share", label: "Поделиться", icon: <Share2 size={16} />, disabled: !ready, onClick: () => ready && share(ready) }]
          : []),
      ];

  return { actions, busy: sending, prepare };
}
