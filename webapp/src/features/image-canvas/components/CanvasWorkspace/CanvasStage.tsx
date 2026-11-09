import { ActionIcon, Alert, Badge, Button, Group, Loader, Text } from "@mantine/core";
import { AnimatePresence } from "framer-motion";
import { Check, ChevronLeft, ChevronRight, ImagePlus } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { ImageLightbox } from "../../../../shared/components/ImageLightbox";
import { getItemImage, getReferenceImage } from "../../api/image-canvas-api";
import type { CanvasState } from "../../hooks/useCanvas";
import { useRemoteImage } from "../../hooks/useRemoteImage";
import { makeThumb } from "../../lib/canvasImages";
import { slideKeyDelta, slideKeysBlocked } from "../../lib/slideKeys";
import type { ImageCanvas } from "../../types/imageCanvas";
import styles from "./CanvasWorkspace.module.css";

const MODEL_LABEL = { qwen: "Qwen", qwen_turbo: "Turbo" } as const;
/** Сдвиг пальца, после которого свайп листает черновик. */
const SWIPE_PX = 50;

interface CanvasStageProps {
  canvas: ImageCanvas;
  actions: CanvasState;
}

/** Ключ кэша картинки слота: по миниатюре — заменённая картинка не возьмётся из кэша. */
export function referenceKey(canvasId: number, slot: number, thumb: string): string {
  return `ref:${canvasId}:${slot}:${thumb.length}:${thumb.slice(-24)}`;
}

/**
 * Холст листается свайпом и стрелками: первым — оригинал (картинка 1), за ним черновики, новые первыми.
 * Так результат сравнивается с исходником одним свайпом. Пришёл новый черновик — показываем его.
 * Под черновиком — «Сохранить» и «Отбросить». Полноэкранный просмотр листается так же и держит тот же слайд.
 * Генерация холст не закрывает: её ход и «Остановить» — на кнопке запуска (GenerateButton).
 */
export function CanvasStage({ canvas, actions }: CanvasStageProps) {
  const { drafts, generation } = canvas;
  const [index, setIndex] = useState(0);
  const [zoom, setZoom] = useState(false);
  const swipeStart = useRef<number | null>(null);
  // Свайп мышью заканчивается кликом по картинке — он не должен открывать просмотр.
  const swiped = useRef(false);

  const baseThumb = canvas.references[0];
  // Слайд 0 — оригинал, если картинка 1 прикреплена; дальше черновики.
  const offset = baseThumb ? 1 : 0;
  const slideCount = offset + drafts.length;

  // Пришёл новый черновик — показываем его (первый после оригинала).
  const newestId = drafts[0]?.id;
  useEffect(() => setIndex(newestId === undefined ? 0 : offset), [newestId, offset]);
  const safeIndex = Math.min(index, Math.max(0, slideCount - 1));
  const draftIndex = safeIndex - offset;
  const draft = draftIndex >= 0 ? drafts[draftIndex] : undefined;
  const showingOriginal = !draft && Boolean(baseThumb);
  const draftImage = useRemoteImage(draft ? `item:${canvas.id}:${draft.id}` : null, () =>
    getItemImage(canvas.id, draft!.id).then((r) => r.image),
  );
  const baseImage = useRemoteImage(!draft && baseThumb ? referenceKey(canvas.id, 0, baseThumb) : null, () =>
    getReferenceImage(canvas.id, 0).then((r) => r.image),
  );
  // Пока полная картинка 1 грузится — её миниатюра, чтобы холст не стоял пустым.
  const src = draft ? draftImage.src : (baseImage.src ?? baseThumb);

  const caption = draft ? `Черновик ${draftIndex + 1} из ${drafts.length} · ${MODEL_LABEL[draft.model]}` : "Оригинал";
  const go = (delta: number) => setIndex((i) => Math.min(slideCount - 1, Math.max(0, i + delta)));

  // Стрелки ←/→ на компьютере. Обработчик на window живёт весь экран, а число слайдов и просмотр меняются.
  const keyGo = useRef<(delta: -1 | 1) => void>(() => undefined);
  keyGo.current = (delta) => {
    if (!zoom) go(delta);
  };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const delta = slideKeyDelta(e);
      if (delta === null || slideKeysBlocked(e.target)) return;
      e.preventDefault();
      keyGo.current(delta);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const save = async () => {
    if (!draft || !draftImage.src) return;
    await actions.saveDraft(draft.id, await makeThumb(draftImage.src));
  };

  return (
    <div className={styles.stage}>
      {generation.status === "error" && generation.error && (
        <Alert color="red" variant="light" p="xs">
          <Text size="sm">{generation.error}</Text>
        </Alert>
      )}

      <div
        className={styles.frame}
        data-draft={Boolean(draft)}
        onPointerDown={(e) => (swipeStart.current = e.clientX)}
        onPointerUp={(e) => {
          if (swipeStart.current === null) return;
          const dx = e.clientX - swipeStart.current;
          swipeStart.current = null;
          swiped.current = Math.abs(dx) > SWIPE_PX;
          if (swiped.current) go(dx < 0 ? 1 : -1);
        }}
      >
        {src ? (
          <img
            className={styles.frameImage}
            src={src}
            alt={draft ? "Черновик" : "Оригинал"}
            draggable={false}
            onClick={() => !swiped.current && setZoom(true)}
          />
        ) : draft && !draftImage.failed ? (
          <Loader />
        ) : (
          <div className={styles.frameOverlay}>
            <ImagePlus size={32} color="var(--mantine-color-dimmed)" />
            <Text size="sm" c="dimmed" maw={260}>
              Прикрепите внизу картинку, которую нужно изменить, и напишите, что сделать
            </Text>
          </div>
        )}

        {draft && (
          <Badge className={styles.frameChip} variant="default" size="lg" radius="sm">
            {caption}
          </Badge>
        )}
        {/* Подпись оригинала — только когда есть с чем сравнивать, иначе он и так единственный. */}
        {showingOriginal && drafts.length > 0 && (
          <Badge className={styles.frameChip} variant="default" size="lg" radius="sm">
            Оригинал
          </Badge>
        )}

        {slideCount > 1 && (
          <>
            {safeIndex > 0 && (
              <ActionIcon className={`${styles.frameNav} ${styles.frameNavPrev}`} variant="default" radius="xl" onClick={() => go(-1)} aria-label="Предыдущая картинка">
                <ChevronLeft size={18} />
              </ActionIcon>
            )}
            {safeIndex < slideCount - 1 && (
              <ActionIcon className={`${styles.frameNav} ${styles.frameNavNext}`} variant="default" radius="xl" onClick={() => go(1)} aria-label="Следующая картинка">
                <ChevronRight size={18} />
              </ActionIcon>
            )}
          </>
        )}

      </div>

      <div className={styles.dots}>
        {slideCount > 1 &&
          Array.from({ length: slideCount }, (_, i) => (
            <button
              key={i < offset ? "original" : drafts[i - offset]!.id}
              type="button"
              className={styles.dot}
              data-active={i === safeIndex}
              data-original={i < offset}
              onClick={() => setIndex(i)}
              aria-label={i < offset ? "Оригинал" : `Черновик ${i - offset + 1}`}
            />
          ))}
      </div>

      {/* На оригинале кнопки скрыты, но место держат: иначе рамка меняла бы высоту при свайпе
          и сравнивать картинки было бы неудобно. */}
      {drafts.length > 0 && (
        <Group gap="xs" wrap="nowrap" className={styles.draftActions} data-hidden={!draft} aria-hidden={!draft}>
          <Button
            flex={1}
            leftSection={<Check size={16} />}
            loading={actions.busy === "save"}
            disabled={!draft || !draftImage.src || actions.busy !== null}
            onClick={() => void save()}
          >
            Сохранить
          </Button>
          <Button
            variant="default"
            disabled={!draft || actions.busy !== null}
            loading={actions.busy === "delete"}
            onClick={() => draft && void actions.deleteItem(draft.id)}
          >
            Отбросить
          </Button>
        </Group>
      )}

      {/* В просмотр — только полная картинка (миниатюра оригинала там была бы мутной): пока грузится — спиннер. */}
      <AnimatePresence>
        {zoom && (
          <ImageLightbox
            src={draft ? draftImage.src : baseImage.src}
            navigation={{
              caption: slideCount > 1 ? caption : undefined,
              onPrev: safeIndex > 0 ? () => go(-1) : undefined,
              onNext: safeIndex < slideCount - 1 ? () => go(1) : undefined,
            }}
            onClose={() => setZoom(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
