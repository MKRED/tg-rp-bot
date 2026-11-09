import type { ComfyModelId } from "@tg-rp-bot/shared";
import { MODEL_REQUIREMENTS } from "../../comfy-agent/readiness/index.js";

/** Узел графа в API-формате ComfyUI (`POST /api/prompt`): ссылка на выход — `[id узла, номер выхода]`. */
export interface ComfyNode {
  class_type: string;
  inputs: Record<string, unknown>;
}

export type ComfyGraph = Record<string, ComfyNode>;

export interface EditGraphInput {
  model: ComfyModelId;
  prompt: string;
  /** Загруженные в ComfyUI картинки по порядку (`subfolder/name`): первая — `<image1>`, задаёт кадр. */
  images: string[];
  seed: number;
  /** Префикс файла результата в output ComfyUI. */
  filenamePrefix: string;
}

/** Расписание сигм Turbo — из рабочего графа 8 (8 шагов дистиллированной модели). */
export const TURBO_SIGMAS = "1.0, 0.978453, 0.95418, 0.926626, 0.89508, 0.845148, 0.704534, 0.414568, 0";
/** Шагов у обычной модели (графу 9: официально 40–50, шаблон ComfyUI — 25). */
export const QWEN_STEPS = 45;
/**
 * Референсы приводятся к ~resolution² пикселей. 0 (как в шаблоне) — каждая картинка в своём размере:
 * большая картинка пользователя раздула бы и время, и память; 1024 — проверено на графах 8 и 9.
 */
export const REFERENCE_RESOLUTION = 1024;

function fileName(model: ComfyModelId, loader: string): string {
  const requirement = MODEL_REQUIREMENTS.find((r) => r.id === model);
  const file = requirement?.files.find((f) => f.loader === loader)?.file;
  if (!file) throw new Error(`No ${loader} file for model ${model}`);
  return file;
}

/**
 * Граф редактирования картинки Qwen-Image 2.1 (обычная или Turbo) по рабочим графам 8 и 9
 * (docs/plan/image-generation-workflows). Имена файлов моделей — из MODEL_REQUIREMENTS, чтобы проверка
 * готовности и граф не расходились. CFG 1: отрицательный промпт не действует, поэтому пустой.
 */
export function buildEditGraph({ model, prompt, images, seed, filenamePrefix }: EditGraphInput): ComfyGraph {
  if (images.length === 0) throw new Error("Edit graph needs at least one image");
  const graph: ComfyGraph = {
    unet: { class_type: "UNETLoader", inputs: { unet_name: fileName(model, "UNETLoader"), weight_dtype: "default" } },
    clip: { class_type: "CLIPLoader", inputs: { clip_name: fileName(model, "CLIPLoader"), type: "qwen_image", device: "default" } },
    vae: { class_type: "VAELoader", inputs: { vae_name: fileName(model, "VAELoader") } },
    cache: { class_type: "QwenImage21Cache", inputs: { model: ["unet", 0], device: "auto", dtype: "default" } },
  };

  const encodeInputs: Record<string, unknown> = {
    clip: ["clip", 0],
    vae: ["vae", 0],
    prompt,
    negative_prompt: "",
    resolution: REFERENCE_RESOLUTION,
  };
  images.forEach((image, i) => {
    const id = `image_${i + 1}`;
    graph[id] = { class_type: "LoadImage", inputs: { image } };
    // COMFY_AUTOGROW_V3: в API-формате элементы списка — ключи «images.image_N».
    encodeInputs[`images.${id}`] = [id, 0];
  });
  // Выходы энкодера: 0 — positive, 1 — negative, 2 — латент размера первой картинки.
  graph.encode = { class_type: "TextEncodeQwenImage21", inputs: encodeInputs };

  if (model === "qwen_turbo") {
    graph.noise = { class_type: "RandomNoise", inputs: { noise_seed: seed } };
    graph.guider = { class_type: "CFGGuider", inputs: { model: ["cache", 0], positive: ["encode", 0], negative: ["encode", 1], cfg: 1 } };
    graph.sampler = { class_type: "KSamplerSelect", inputs: { sampler_name: "euler" } };
    graph.sigmas = { class_type: "ManualSigmas", inputs: { sigmas: TURBO_SIGMAS } };
    graph.sample = {
      class_type: "SamplerCustomAdvanced",
      inputs: { noise: ["noise", 0], guider: ["guider", 0], sampler: ["sampler", 0], sigmas: ["sigmas", 0], latent_image: ["encode", 2] },
    };
  } else {
    graph.sample = {
      class_type: "KSampler",
      inputs: {
        model: ["cache", 0],
        positive: ["encode", 0],
        negative: ["encode", 1],
        latent_image: ["encode", 2],
        seed,
        steps: QWEN_STEPS,
        cfg: 1,
        sampler_name: "euler",
        scheduler: "simple",
        denoise: 1,
      },
    };
  }

  graph.decode = { class_type: "VAEDecode", inputs: { samples: ["sample", 0], vae: ["vae", 0] } };
  graph.save = { class_type: "SaveImage", inputs: { images: ["decode", 0], filename_prefix: filenamePrefix } };
  return graph;
}

/** Наибольший номер `<imageN>` в промпте (0 — тегов нет). Тег без картинки — ошибка пользователя. */
export function maxImageTag(prompt: string): number {
  let max = 0;
  for (const match of prompt.matchAll(/<image(\d+)>/g)) max = Math.max(max, Number(match[1]));
  return max;
}

/** Случайный seed в пределах безопасного целого (уходит в JSON и в bigint БД без потерь). */
export function randomSeed(random: () => number = Math.random): number {
  return Math.floor(random() * Number.MAX_SAFE_INTEGER);
}
