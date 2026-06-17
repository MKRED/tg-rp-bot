import { motion } from "framer-motion";
import { useEffect } from "react";
import { createPortal } from "react-dom";
import { pushBackInterceptor } from "../telegram/backInterceptor";
import "./ImageLightbox.css";

interface ImageLightboxProps {
  src: string;
  onClose: () => void;
}

/**
 * Полноэкранный просмотр изображения. Нажатие в любое место закрывает.
 * Рендерится через portal в document.body — избегает z-index конфликтов.
 * AnimatePresence в родителе (CharacterAvatar) координирует exit-анимацию перед unmount.
 */
export function ImageLightbox({ src, onClose }: ImageLightboxProps) {
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  // Нативная «Назад» закрывает просмотр, а не уводит со страницы.
  useEffect(() => pushBackInterceptor(onClose), [onClose]);

  return createPortal(
    <motion.div
      className="image-lightbox"
      onClick={(e) => { e.stopPropagation(); onClose(); }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
    >
      <motion.img
        className="image-lightbox__img"
        src={src}
        alt=""
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.8, opacity: 0 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
      />
    </motion.div>,
    document.body,
  );
}
