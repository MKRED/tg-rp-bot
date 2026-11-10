import { Badge, Button, Group, Loader, Stack, Text, UnstyledButton } from "@mantine/core";
import { AnimatePresence } from "framer-motion";
import { Download, Images, Repeat, Send, Trash2, Wand2 } from "lucide-react";
import { useState } from "react";
import { sendPhotoToChat } from "../../../../shared/api/sendPhoto";
import { EmptyState } from "../../../../shared/components/EmptyState";
import { ImageLightbox } from "../../../../shared/components/ImageLightbox";
import { ResponsiveSheet } from "../../../../shared/components/ResponsiveSheet";
import { downloadFile, imageFile, makeShareable } from "../../../../shared/image/share";
import { confirmAction } from "../../../../shared/telegram/confirm";
import { isInsideTelegram } from "../../../../shared/telegram/initData";
import { useToast } from "../../../../shared/toast";
import { getItemImage } from "../../api/image-canvas-api";
import type { CanvasState } from "../../hooks/useCanvas";
import { useRemoteImage } from "../../hooks/useRemoteImage";
import { MAX_CANVAS_VARIANTS, type CanvasVariant, type ImageCanvas } from "../../types/imageCanvas";
import styles from "./CanvasWorkspace.module.css";

const MODEL_LABEL = { qwen: "Qwen", qwen_turbo: "Turbo" } as const;

interface VariantsGalleryProps {
  canvas: ImageCanvas;
  actions: CanvasState;
  /** «В работу» и «Повторить» переключают на холст. */
  onToCanvas: () => void;
  /** «Повторить»: промпт варианта — в поле ввода холста. */
  onRepeat: (variant: CanvasVariant) => void;
}

/** Вкладка «Варианты»: сохранённые результаты сеткой; тап — просмотр с действиями. */
export function VariantsGallery({ canvas, actions, onToCanvas, onRepeat }: VariantsGalleryProps) {
  const [openId, setOpenId] = useState<number | null>(null);
  const open = canvas.variants.find((v) => v.id === openId);

  if (canvas.variants.length === 0) {
    return (
      <div className={styles.center}>
        <EmptyState
          icon={Images}
          title="Здесь будут сохранённые варианты"
          description="Удачный черновик на холсте сохраните кнопкой «Сохранить» — он появится здесь."
        />
      </div>
    );
  }

  return (
    <div className={styles.gallery}>
      <Text size="xs" c="dimmed" mb="xs">
        {canvas.variants.length} из {MAX_CANVAS_VARIANTS}
      </Text>
      <div className={styles.galleryGrid}>
        {canvas.variants.map((variant) => (
          <UnstyledButton key={variant.id} className={styles.galleryItem} onClick={() => setOpenId(variant.id)} aria-label="Открыть вариант">
            <img src={variant.thumb} alt="" />
          </UnstyledButton>
        ))}
      </div>
      <ResponsiveSheet opened={Boolean(open)} onClose={() => setOpenId(null)} title="Вариант">
        {open && (
          <VariantDetails
            canvas={canvas}
            variant={open}
            actions={actions}
            onClose={() => setOpenId(null)}
            onToCanvas={onToCanvas}
            onRepeat={onRepeat}
          />
        )}
      </ResponsiveSheet>
    </div>
  );
}

interface VariantDetailsProps {
  canvas: ImageCanvas;
  variant: CanvasVariant;
  actions: CanvasState;
  onClose: () => void;
  onToCanvas: () => void;
  onRepeat: (variant: CanvasVariant) => void;
}

function VariantDetails({ canvas, variant, actions, onClose, onToCanvas, onRepeat }: VariantDetailsProps) {
  const { showToast } = useToast();
  const [zoom, setZoom] = useState(false);
  const [sharing, setSharing] = useState(false);
  const image = useRemoteImage(`item:${canvas.id}:${variant.id}`, () => getItemImage(canvas.id, variant.id).then((r) => r.image));
  const inTelegram = isInsideTelegram();

  const toWork = async () => {
    if (await actions.useVariant(variant.id)) {
      onClose();
      onToCanvas();
    }
  };

  // В Telegram webview скачивание файла не работает — отправляем в чат с ботом (как аватары).
  const share = async () => {
    if (!image.src) return;
    setSharing(true);
    try {
      if (inTelegram) {
        await sendPhotoToChat(await makeShareable(image.src));
        showToast({ type: "success", message: "Отправлено в чат" });
      } else {
        const file = await imageFile(image.src, `${canvas.name}-${variant.id}`);
        downloadFile(file, file.name);
      }
    } catch (err) {
      console.error("Failed to share canvas variant", err);
      showToast({ type: "error", message: "Не удалось отправить картинку" });
    } finally {
      setSharing(false);
    }
  };

  const remove = async () => {
    const confirmed = await confirmAction("Вариант удалится без возможности восстановления.", { title: "Удалить вариант?" });
    if (confirmed && (await actions.deleteItem(variant.id))) onClose();
  };

  return (
    <Stack gap="sm">
      <div className={styles.sheetImage}>
        {image.src ? <img src={image.src} alt="Вариант" onClick={() => setZoom(true)} /> : image.failed ? <Text c="dimmed">Не удалось загрузить</Text> : <Loader />}
      </div>
      <Group gap="xs">
        <Badge variant="light">{MODEL_LABEL[variant.model]}</Badge>
        {variant.width && variant.height && (
          <Text size="xs" c="dimmed">
            {variant.width}×{variant.height}
          </Text>
        )}
      </Group>
      <Text size="sm" style={{ whiteSpace: "pre-wrap" }}>
        {variant.prompt}
      </Text>
      <Group gap="xs" grow>
        <Button leftSection={<Wand2 size={16} />} loading={actions.busy === "use"} onClick={() => void toWork()}>
          В работу
        </Button>
        <Button
          variant="default"
          leftSection={<Repeat size={16} />}
          onClick={() => {
            onRepeat(variant);
            onClose();
          }}
        >
          Повторить
        </Button>
      </Group>
      <Group gap="xs" grow>
        <Button variant="default" leftSection={inTelegram ? <Send size={16} /> : <Download size={16} />} loading={sharing} disabled={!image.src} onClick={() => void share()}>
          {inTelegram ? "В чат" : "Скачать"}
        </Button>
        <Button variant="subtle" color="red" leftSection={<Trash2 size={16} />} loading={actions.busy === "delete"} onClick={() => void remove()}>
          Удалить
        </Button>
      </Group>
      <Text size="xs" c="dimmed">
        «В работу» — вариант станет картинкой 1 на холсте. «Повторить» — перенесёт промпт и модель.
      </Text>
      <AnimatePresence>{zoom && image.src && <ImageLightbox src={image.src} onClose={() => setZoom(false)} />}</AnimatePresence>
    </Stack>
  );
}
