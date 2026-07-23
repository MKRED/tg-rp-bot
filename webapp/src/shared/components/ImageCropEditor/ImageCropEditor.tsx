import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import Cropper, { type Area } from "react-easy-crop";
import { createPortal } from "react-dom";
import type { CropArea } from "../../image";
import { pushBackInterceptor } from "../../telegram/backInterceptor";
// CSS react-easy-crop НЕ инжектится сам (sideEffects:false) — импортируем явно, иначе кроппер
// рендерится сломанным (контейнер/маска/contain не спозиционированы).
import "react-easy-crop/react-easy-crop.css";
import "./ImageCropEditor.css";

interface ImageCropEditorProps {
  /** Источник для редактирования (object URL выбранного файла). */
  src: string;
  /** Идёт обработка кропа в родителе — блокирует кнопки от повторного нажатия. */
  busy?: boolean;
  /** Подтверждение: область кропа в натуральных пикселях исходника. */
  onConfirm: (crop: CropArea) => void;
  onCancel: () => void;
}

const MIN_ZOOM = 1;
const MAX_ZOOM = 4;

/**
 * Полноэкранный редактор кропа аватара: пользователь панорамирует/зумирует фото в круглой рамке,
 * выбирая, какой квадрат пойдёт в миниатюру. На react-easy-crop — обкатанные pinch/pan в webview.
 *
 * Рендерится через portal в body, поверх формы. Кнопки/слайдер — на собственном CSS, БЕЗ
 * tgui-компонентов: портал в body выходит из-под <AppRoot>, где живут CSS-переменные темы tgui,
 * поэтому tgui Button здесь отрисовался бы нестилизованным (как в ImageLightbox).
 * Полное фото при этом не кадрируется (хранится отдельно), здесь выбирается только миниатюра.
 */
export function ImageCropEditor({ src, busy = false, onConfirm, onCancel }: ImageCropEditorProps) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  // croppedAreaPixels приходит из onCropComplete — это и есть область в пикселях исходника.
  const [areaPixels, setAreaPixels] = useState<Area | null>(null);

  // Нативная «Назад» закрывает редактор, а не уводит со страницы редактирования.
  useEffect(() => pushBackInterceptor(onCancel), [onCancel]);

  return createPortal(
    <motion.div
      className="crop-editor"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
    >
      <div className="crop-editor__header">
        <div className="crop-editor__title">Миниатюра</div>
        <div className="crop-editor__hint">Перетащите и масштабируйте фото</div>
      </div>

      <div className="crop-editor__area">
        <Cropper
          image={src}
          crop={crop}
          zoom={zoom}
          minZoom={MIN_ZOOM}
          maxZoom={MAX_ZOOM}
          aspect={1}
          cropShape="round"
          showGrid={false}
          onCropChange={setCrop}
          onZoomChange={setZoom}
          onCropComplete={(_, areaPx) => setAreaPixels(areaPx)}
        />
      </div>

      <div className="crop-editor__controls">
        <div className="crop-editor__zoom-row">
          {/* Иконки «маленькое/большое фото» по краям слайдера — подсказывают направление зума. */}
          <span className="crop-editor__zoom-icon" aria-hidden>
            <ImageGlyph size={14} />
          </span>
          <input
            className="crop-editor__zoom"
            type="range"
            min={MIN_ZOOM}
            max={MAX_ZOOM}
            step={0.01}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            aria-label="Масштаб"
          />
          <span className="crop-editor__zoom-icon" aria-hidden>
            <ImageGlyph size={20} />
          </span>
        </div>
        <div className="crop-editor__actions">
          <button
            type="button"
            className="crop-editor__btn crop-editor__btn--ghost"
            disabled={busy}
            onClick={onCancel}
          >
            Отмена
          </button>
          <button
            type="button"
            className="crop-editor__btn crop-editor__btn--primary"
            disabled={busy || !areaPixels}
            onClick={() => areaPixels && onConfirm(areaPixels)}
          >
            {busy ? "Обработка…" : "Готово"}
          </button>
        </div>
      </div>
    </motion.div>,
    document.body,
  );
}

/** Простой глиф «фото» (горы + солнце) для подписи слайдера зума. */
function ImageGlyph({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="3" y="4" width="18" height="16" rx="3" stroke="currentColor" strokeWidth="2" />
      <circle cx="8.5" cy="9" r="1.6" fill="currentColor" />
      <path d="M5 18l4.5-5 3 3.2L16 12l3 6" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
    </svg>
  );
}
