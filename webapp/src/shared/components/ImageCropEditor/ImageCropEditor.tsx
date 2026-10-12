import { Button, Slider, Text } from "@mantine/core";
import { motion } from "framer-motion";
import { Image as ImageIcon } from "lucide-react";
import { useEffect, useState } from "react";
import Cropper, { type Area } from "react-easy-crop";
import { createPortal } from "react-dom";
import type { CropArea } from "../../image";
import { pushBackInterceptor } from "../../telegram/backInterceptor";
import { MOTION_TRANSITION } from "../../theme/motion";
// CSS react-easy-crop НЕ инжектится сам (sideEffects:false) — импортируем явно, иначе кроппер
// рендерится сломанным (контейнер/маска/contain не спозиционированы).
import "react-easy-crop/react-easy-crop.css";
import styles from "./ImageCropEditor.module.css";

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
 * Рендерится через portal в body поверх формы. Намеренно тёмный в любой схеме — как нативный
 * фоторедактор: фото читается лучше на чёрном. Полное фото при этом не кадрируется (хранится
 * отдельно), здесь выбирается только миниатюра.
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
      className={styles.root}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={MOTION_TRANSITION}
    >
      <div className={styles.header}>
        <Text fw={600}>Миниатюра</Text>
        <Text size="sm" className={styles.hint}>
          Перетащите и масштабируйте фото
        </Text>
      </div>

      <div className={styles.area}>
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

      <div className={styles.controls}>
        {/* Иконки «маленькое/большое фото» по краям слайдера — подсказывают направление зума. */}
        <div className={styles.zoomRow}>
          <ImageIcon size={14} className={styles.zoomIcon} aria-hidden />
          <Slider
            className={styles.zoom}
            classNames={{ track: styles.zoomTrack }}
            min={MIN_ZOOM}
            max={MAX_ZOOM}
            step={0.01}
            value={zoom}
            onChange={setZoom}
            label={null}
            thumbLabel="Масштаб"
          />
          <ImageIcon size={20} className={styles.zoomIcon} aria-hidden />
        </div>
        <div className={styles.actions}>
          <Button variant="filled" color="dark" className={styles.action} disabled={busy} onClick={onCancel}>
            Отмена
          </Button>
          <Button
            className={styles.action}
            loading={busy}
            disabled={!areaPixels}
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
