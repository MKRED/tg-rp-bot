import { useCallback, useEffect, useState } from "react";
import { createCanvas, listCanvases } from "../api/image-canvas-api";
import type { ImageCanvas, ImageCanvasListItem } from "../types/imageCanvas";

/** Список холстов раздела «Картинки». */
export function useCanvasList() {
  const [items, setItems] = useState<ImageCanvasListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    listCanvases()
      .then(setItems)
      .catch((err) => {
        console.error("Failed to load image canvases", err);
        setError(true);
      })
      .finally(() => setLoading(false));
  }, []);

  const create = useCallback((name?: string): Promise<ImageCanvas> => createCanvas(name), []);

  return { items, loading, error, create };
}
