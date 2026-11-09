import type { ComfyReadiness } from "@tg-rp-bot/shared";
import { MODEL_REQUIREMENTS, type ModelRequirement } from "./requirements.js";

/** Ответ /api/object_info/<Node> по каждой ноде: `{}` — такой ноды в ComfyUI нет. */
export type ObjectInfoByNode = Record<string, Record<string, unknown>>;

/**
 * Собирает отчёт о готовности ComfyUI из ответов system_stats и object_info. Чистая функция:
 * запросы к ComfyUI делает сервис, здесь — только разбор их форматов.
 */
export function evaluateReadiness(
  systemStats: unknown,
  objectInfo: ObjectInfoByNode,
  requirements: ModelRequirement[] = MODEL_REQUIREMENTS,
): ComfyReadiness {
  return {
    comfyuiVersion: readVersion(systemStats),
    gpu: readGpu(systemStats),
    models: requirements.map((req) => {
      const missingNodes = req.nodes.filter((node) => !nodeDef(objectInfo, node));
      const missingFiles = req.files
        .filter((f) => !comboOptions(nodeDef(objectInfo, f.loader), f.input).includes(f.file))
        .map(({ folder, file }) => ({ folder, file }));
      return { id: req.id, label: req.label, ready: missingNodes.length === 0 && missingFiles.length === 0, missingNodes, missingFiles };
    }),
  };
}

function nodeDef(objectInfo: ObjectInfoByNode, node: string): Record<string, unknown> | undefined {
  const def = objectInfo[node]?.[node];
  return def && typeof def === "object" ? (def as Record<string, unknown>) : undefined;
}

/**
 * Варианты выпадающего списка ноды. ComfyUI отдаёт два формата: старый `[["a", "b"], {...}]`
 * (так выглядят списки файлов загрузчиков) и новый `["COMBO", { options: [...] }]`.
 */
export function comboOptions(def: Record<string, unknown> | undefined, input: string): string[] {
  const inputs = def?.input as { required?: Record<string, unknown>; optional?: Record<string, unknown> } | undefined;
  const spec = inputs?.required?.[input] ?? inputs?.optional?.[input];
  if (!Array.isArray(spec)) return [];
  if (Array.isArray(spec[0])) return spec[0].filter((v): v is string => typeof v === "string");
  const options = (spec[1] as { options?: unknown } | undefined)?.options;
  return Array.isArray(options) ? options.filter((v): v is string => typeof v === "string") : [];
}

function readVersion(stats: unknown): string | null {
  const version = (stats as { system?: { comfyui_version?: unknown } } | null)?.system?.comfyui_version;
  return typeof version === "string" ? version : null;
}

/** «cuda:0 NVIDIA GeForce RTX 5070 Ti : cudaMallocAsync» → «NVIDIA GeForce RTX 5070 Ti». */
function cleanDeviceName(raw: string): string {
  return raw.replace(/^\w+:\d+\s+/, "").replace(/\s+:\s+.*$/, "").trim() || raw;
}

function readGpu(stats: unknown): ComfyReadiness["gpu"] {
  const devices = (stats as { devices?: unknown } | null)?.devices;
  if (!Array.isArray(devices)) return null;
  const gpu = devices.find((d) => d && typeof d === "object" && (d as { type?: unknown }).type !== "cpu") as
    | { name?: unknown; vram_total?: unknown; vram_free?: unknown }
    | undefined;
  if (!gpu || typeof gpu.vram_total !== "number") return null;
  return {
    name: typeof gpu.name === "string" ? cleanDeviceName(gpu.name) : "GPU",
    vramTotalBytes: gpu.vram_total,
    vramFreeBytes: typeof gpu.vram_free === "number" ? gpu.vram_free : 0,
  };
}
