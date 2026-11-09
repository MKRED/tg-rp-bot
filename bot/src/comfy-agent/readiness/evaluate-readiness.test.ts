import { describe, expect, it } from "vitest";
import { comboOptions, evaluateReadiness, type ObjectInfoByNode } from "./evaluate-readiness.js";
import { MODEL_REQUIREMENTS, requiredNodeTypes } from "./requirements.js";

const STATS = {
  system: { comfyui_version: "0.44.0" },
  devices: [{ name: "cuda:0 NVIDIA GeForce RTX 5070 Ti : cudaMallocAsync", type: "cuda", vram_total: 17066033152, vram_free: 15769534464 }],
};

/** object_info со всеми нужными нодами; загрузчики — в старом формате списков, как отдаёт ComfyUI. */
function fullObjectInfo(): ObjectInfoByNode {
  const info: ObjectInfoByNode = {};
  for (const node of requiredNodeTypes()) info[node] = { [node]: { input: { required: {} } } };
  const loader = (name: string, input: string, files: string[]) => ({ [name]: { input: { required: { [input]: [files] } } } });
  info.UNETLoader = loader("UNETLoader", "unet_name", ["qwen_image_2.1_int8_convrot.safetensors", "qwen_image_2.1_turbo_int8_convrot.safetensors"]);
  info.CLIPLoader = loader("CLIPLoader", "clip_name", ["qwen3vl_8b_int8_convrot.safetensors"]);
  info.VAELoader = loader("VAELoader", "vae_name", ["qwen_image_2.1_vae_bf16.safetensors"]);
  return info;
}

describe("evaluateReadiness", () => {
  it("всё на месте — обе модели готовы, версия и видеокарта прочитаны", () => {
    const r = evaluateReadiness(STATS, fullObjectInfo());
    expect(r.comfyuiVersion).toBe("0.44.0");
    expect(r.gpu).toEqual({ name: "NVIDIA GeForce RTX 5070 Ti", vramTotalBytes: 17066033152, vramFreeBytes: 15769534464 });
    expect(r.models.map((m) => [m.id, m.ready])).toEqual([
      ["qwen", true],
      ["qwen_turbo", true],
    ]);
  });

  it("нет ноды (ComfyUI отвечает {}) — модель не готова, нода названа", () => {
    const info = fullObjectInfo();
    info.ManualSigmas = {};
    const [qwen, turbo] = evaluateReadiness(STATS, info).models;
    expect(qwen.ready).toBe(true);
    expect(turbo).toMatchObject({ ready: false, missingNodes: ["ManualSigmas"], missingFiles: [] });
  });

  it("нет файла Turbo — не готова только Turbo, с папкой для подсказки", () => {
    const info = fullObjectInfo();
    info.UNETLoader = { UNETLoader: { input: { required: { unet_name: [["qwen_image_2.1_int8_convrot.safetensors"]] } } } };
    const [qwen, turbo] = evaluateReadiness(STATS, info).models;
    expect(qwen.ready).toBe(true);
    expect(turbo.missingFiles).toEqual([{ folder: "diffusion_models", file: "qwen_image_2.1_turbo_int8_convrot.safetensors" }]);
  });

  it("нет загрузчика — нет и его файлов", () => {
    const info = fullObjectInfo();
    info.VAELoader = {};
    const [qwen] = evaluateReadiness(STATS, info).models;
    expect(qwen.missingNodes).toEqual(["VAELoader"]);
    expect(qwen.missingFiles).toEqual([{ folder: "vae", file: "qwen_image_2.1_vae_bf16.safetensors" }]);
  });

  it("ComfyUI на CPU или без данных — gpu и версия null", () => {
    const r = evaluateReadiness({ devices: [{ name: "cpu", type: "cpu", vram_total: 0 }] }, fullObjectInfo());
    expect(r.gpu).toBeNull();
    expect(evaluateReadiness(null, {}).comfyuiVersion).toBeNull();
  });

  it("требования покрывают обе модели", () => {
    expect(MODEL_REQUIREMENTS.map((m) => m.id)).toEqual(["qwen", "qwen_turbo"]);
  });
});

describe("comboOptions", () => {
  it("читает старый и новый формат списка", () => {
    expect(comboOptions({ input: { required: { a: [["x", "y"]] } } }, "a")).toEqual(["x", "y"]);
    expect(comboOptions({ input: { optional: { a: ["COMBO", { options: ["z"] }] } } }, "a")).toEqual(["z"]);
    expect(comboOptions({ input: { required: { a: ["MODEL", {}] } } }, "a")).toEqual([]);
    expect(comboOptions(undefined, "a")).toEqual([]);
  });
});
