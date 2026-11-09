import type { ComfyModelId } from "@tg-rp-bot/shared";

/** Файл модели и нода-загрузчик, в списке которой ComfyUI показывает файлы этой папки. */
export interface RequiredFile {
  /** Папка в ComfyUI/models — для подсказки пользователю, куда положить файл. */
  folder: string;
  loader: string;
  /** Имя входа загрузчика со списком файлов. */
  input: string;
  file: string;
}

export interface ModelRequirement {
  id: ComfyModelId;
  label: string;
  nodes: string[];
  files: RequiredFile[];
}

const TEXT_ENCODER: RequiredFile = { folder: "text_encoders", loader: "CLIPLoader", input: "clip_name", file: "qwen3vl_8b_int8_convrot.safetensors" };
const VAE: RequiredFile = { folder: "vae", loader: "VAELoader", input: "vae_name", file: "qwen_image_2.1_vae_bf16.safetensors" };

// Ноды, общие для обоих графов редактирования (docs/plan/image-generation-workflows/8 и 9).
const COMMON_NODES = ["UNETLoader", "CLIPLoader", "VAELoader", "LoadImage", "TextEncodeQwenImage21", "QwenImage21Cache", "VAEDecode", "SaveImageAdvanced"];

/** Что нужно в ComfyUI для каждой модели — по рабочим графам 8 (Turbo) и 9 (обычная). */
export const MODEL_REQUIREMENTS: ModelRequirement[] = [
  {
    id: "qwen",
    label: "Qwen-Image 2.1",
    nodes: [...COMMON_NODES, "KSampler"],
    files: [{ folder: "diffusion_models", loader: "UNETLoader", input: "unet_name", file: "qwen_image_2.1_int8_convrot.safetensors" }, TEXT_ENCODER, VAE],
  },
  {
    id: "qwen_turbo",
    label: "Qwen-Image 2.1 Turbo",
    nodes: [...COMMON_NODES, "ManualSigmas", "KSamplerSelect", "CFGGuider", "RandomNoise", "SamplerCustomAdvanced"],
    files: [{ folder: "diffusion_models", loader: "UNETLoader", input: "unet_name", file: "qwen_image_2.1_turbo_int8_convrot.safetensors" }, TEXT_ENCODER, VAE],
  },
];

/** Все ноды, о которых нужно спросить ComfyUI (без повторов). */
export function requiredNodeTypes(requirements: ModelRequirement[] = MODEL_REQUIREMENTS): string[] {
  return [...new Set(requirements.flatMap((r) => r.nodes))];
}
