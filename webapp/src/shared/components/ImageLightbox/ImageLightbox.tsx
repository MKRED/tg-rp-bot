import { ImageGallery } from "../ImageGallery";

interface ImageLightboxProps {
  /** Изображение для показа; undefined — полное фото ещё грузится (на экране спиннер). */
  src?: string;
  onClose: () => void;
}

const noop = () => {};

/**
 * Полноэкранный просмотр одной картинки — та же галерея (зум, жесты, шапка с «⋮»: отправка в чат или
 * скачивание), только без счётчика, полосы миниатюр и листания. Ключ слайда постоянный: пришедший src
 * не пересоздаёт слайд. Рендерится в body через portal; AnimatePresence в родителе даёт плавное закрытие.
 */
export function ImageLightbox({ src, onClose }: ImageLightboxProps) {
  return <ImageGallery items={[{ key: "image", src }]} index={0} onIndexChange={noop} onClose={onClose} />;
}
