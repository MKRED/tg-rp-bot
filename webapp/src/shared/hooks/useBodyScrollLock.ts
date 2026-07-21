import { useEffect } from "react";

/**
 * Блокирует скролл фоновой страницы, пока смонтирован полноэкранный portal-оверлей
 * (PromptEditorOverlay, ImageCropEditor, ImageLightbox). position:fixed сам по себе не мешает
 * скролл-чейнингу: свайп внутри оверлея после упора в границу (или по пустым зонам без
 * своего overflow) перетекает на body позади портала. overflow:hidden на body разрывает цепочку.
 */
export function useBodyScrollLock() {
  useEffect(() => {
    const { body } = document;
    const previousOverflow = body.style.overflow;
    body.style.overflow = "hidden";
    return () => {
      body.style.overflow = previousOverflow;
    };
  }, []);
}
