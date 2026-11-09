import { useCallback, useEffect, useRef, useState } from "react";
import { useToast } from "../../../shared/toast";
import * as api from "../api/image-canvas-api";
import type { ImageCanvas, ImageCanvasPatch } from "../types/imageCanvas";

/** Как часто спрашивать холст, пока идёт генерация. */
const RUNNING_POLL_MS = 2000;

/**
 * Состояние холста и действия над ним. Генерацию ведёт сервер; здесь только опрос состояния, пока она
 * идёт, — поэтому обновление страницы посреди генерации её не теряет. Каждое действие возвращает
 * свежий холст целиком: им и заменяем состояние.
 */
export function useCanvas(id: number) {
  const [canvas, setCanvas] = useState<ImageCanvas>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const { showToast } = useToast();

  useEffect(() => {
    api
      .getCanvas(id)
      .then(setCanvas)
      .catch((err) => {
        console.error("Failed to load image canvas", err);
        setError(true);
      })
      .finally(() => setLoading(false));
  }, [id]);

  const running = canvas?.generation.status === "running";
  useEffect(() => {
    if (!running) return;
    const timer = setInterval(() => {
      if (document.visibilityState !== "visible") return;
      api
        .getCanvas(id)
        .then(setCanvas)
        .catch((err) => console.warn("Failed to poll image canvas", err));
    }, RUNNING_POLL_MS);
    return () => clearInterval(timer);
  }, [id, running]);

  /** Действие с индикатором (busy — его имя) и тостом с текстом ошибки сервера. */
  const run = useCallback(
    async (name: string, action: () => Promise<ImageCanvas>, fallback: string): Promise<boolean> => {
      setBusy(name);
      try {
        setCanvas(await action());
        return true;
      } catch (err) {
        console.error(`Image canvas action "${name}" failed`, err);
        showToast({ type: "error", message: err instanceof Error && err.message ? err.message : fallback });
        return false;
      } finally {
        setBusy(null);
      }
    },
    [showToast],
  );

  // Промпт и прочие поля сохраняются тихо: ошибку покажем, но индикатор не нужен.
  const patchSeq = useRef(0);
  const patch = useCallback(
    async (values: ImageCanvasPatch) => {
      const seq = ++patchSeq.current;
      try {
        const updated = await api.updateCanvas(id, values);
        // Ответ на старый запрос не должен затереть более новый ввод.
        if (seq === patchSeq.current) setCanvas((prev) => (prev ? { ...updated, prompt: values.prompt ?? prev.prompt } : updated));
      } catch (err) {
        console.error("Failed to save image canvas", err);
        showToast({ type: "error", message: "Не удалось сохранить изменения холста" });
      }
    },
    [id, showToast],
  );

  return {
    canvas,
    setCanvas,
    loading,
    error,
    busy,
    patch,
    setReference: (slot: number, input: { image: string; thumb: string }) =>
      run("reference", () => api.setReference(id, slot, input), "Не удалось прикрепить картинку"),
    reorderReferences: (order: number[]) =>
      run("reference", () => api.reorderReferences(id, order), "Не удалось переставить картинки"),
    removeReference: (slot: number) => run("reference", () => api.removeReference(id, slot), "Не удалось убрать картинку"),
    generate: () => run("generate", () => api.generate(id), "Не удалось запустить генерацию"),
    cancel: () => run("cancel", () => api.cancelGeneration(id), "Не удалось остановить генерацию"),
    saveDraft: (itemId: number, thumb: string) => run("save", () => api.saveDraft(id, itemId, thumb), "Не удалось сохранить вариант"),
    deleteItem: (itemId: number) => run("delete", () => api.deleteItem(id, itemId), "Не удалось удалить картинку"),
    useVariant: (itemId: number) => run("use", () => api.useVariantAsBase(id, itemId), "Не удалось взять вариант в работу"),
  };
}

export type CanvasState = ReturnType<typeof useCanvas>;
