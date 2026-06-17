import { Button } from "@telegram-apps/telegram-ui";
import { motion } from "framer-motion";
import { useState } from "react";
import Cropper, { type Area } from "react-easy-crop";
import { createPortal } from "react-dom";
import type { CropArea } from "../image";
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

/**
 * Полноэкранный редактор кропа аватара: пользователь панорамирует/зумирует фото в круглой рамке,
 * выбирая, какой квадрат пойдёт в миниатюру. На react-easy-crop — обкатанные pinch/pan в webview.
 * Рендерится через portal в body, поверх формы. Полное фото при этом не кадрируется (хранится
 * отдельно), здесь выбирается только миниатюра.
 */
export function ImageCropEditor({ src, busy = false, onConfirm, onCancel }: ImageCropEditorProps) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  // croppedAreaPixels приходит из onCropComplete — это и есть область в пикселях исходника.
  const [areaPixels, setAreaPixels] = useState<Area | null>(null);

  return createPortal(
    <motion.div
      className="crop-editor"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
    >
      <div className="crop-editor__area">
        <Cropper
          image={src}
          crop={crop}
          zoom={zoom}
          minZoom={1}
          maxZoom={4}
          aspect={1}
          cropShape="round"
          showGrid={false}
          onCropChange={setCrop}
          onZoomChange={setZoom}
          onCropComplete={(_, areaPx) => setAreaPixels(areaPx)}
        />
      </div>

      <div className="crop-editor__controls">
        <input
          className="crop-editor__zoom"
          type="range"
          min={1}
          max={4}
          step={0.01}
          value={zoom}
          onChange={(e) => setZoom(Number(e.target.value))}
          aria-label="Масштаб"
        />
        <div className="crop-editor__actions">
          <Button size="m" mode="outline" stretched disabled={busy} onClick={onCancel}>
            Отмена
          </Button>
          <Button
            size="m"
            stretched
            disabled={busy || !areaPixels}
            onClick={() => areaPixels && onConfirm(areaPixels)}
          >
            Готово
          </Button>
        </div>
      </div>
    </motion.div>,
    document.body,
  );
}
