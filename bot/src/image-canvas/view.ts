import type { CanvasDraft, CanvasVariant, ImageCanvas, ImageCanvasListItem } from "@tg-rp-bot/shared";
import type { CanvasItemMeta, CanvasVariantSummary } from "./image-canvas-items.repository.js";
import type { CanvasListRow, CanvasRecord } from "./image-canvas.repository.js";

/** Холст для webapp: без полных картинок, черновики и варианты новыми первыми. */
export function toCanvasView(canvas: CanvasRecord, items: CanvasItemMeta[]): ImageCanvas {
  const draft = (item: CanvasItemMeta): CanvasDraft => ({
    id: item.id,
    model: item.model,
    prompt: item.prompt,
    width: item.width,
    height: item.height,
    createdAt: item.createdAt.toISOString(),
  });
  return {
    id: canvas.id,
    name: canvas.name,
    model: canvas.model,
    prompt: canvas.prompt,
    references: canvas.referenceThumbs,
    generation: {
      status: canvas.genStatus,
      startedAt: canvas.genStartedAt?.toISOString() ?? null,
      error: canvas.genError,
    },
    drafts: items.filter((i) => i.kind === "draft").map(draft),
    variants: items
      .filter((i): i is CanvasItemMeta & { thumb: string } => i.kind === "variant" && i.thumb !== null)
      .map((i): CanvasVariant => ({ ...draft(i), thumb: i.thumb })),
    updatedAt: canvas.updatedAt.toISOString(),
  };
}

/** Строки списка: миниатюра последнего варианта, иначе первой картинки. */
export function toListView(rows: CanvasListRow[], summaries: CanvasVariantSummary[]): ImageCanvasListItem[] {
  const byCanvas = new Map(summaries.map((s) => [s.canvasId, s]));
  return rows.map((row) => {
    const summary = byCanvas.get(row.id);
    return {
      id: row.id,
      name: row.name,
      model: row.model,
      variantCount: summary?.variantCount ?? 0,
      thumb: summary?.lastThumb ?? row.firstReferenceThumb,
      running: row.genStatus === "running",
      updatedAt: row.updatedAt.toISOString(),
    };
  });
}
