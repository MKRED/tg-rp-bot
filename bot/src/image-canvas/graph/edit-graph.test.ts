import { describe, expect, it } from "vitest";
import { MODEL_REQUIREMENTS } from "../../comfy-agent/readiness/index.js";
import { buildEditGraph, maxImageTag, randomSeed, TURBO_SIGMAS, type ComfyGraph } from "./edit-graph.js";

const BASE = {
  prompt: "<image1> улыбается",
  images: ["tg-rp-bot/a.png", "tg-rp-bot/b.png"],
  seed: 891836227295375,
  filenamePrefix: "tg-rp-bot/canvas",
};

function classTypes(graph: ComfyGraph): string[] {
  return [...new Set(Object.values(graph).map((n) => n.class_type))];
}

/** Ссылки `[id, выход]`, указывающие на несуществующие узлы. */
function danglingLinks(graph: ComfyGraph): string[] {
  return Object.values(graph).flatMap((node) =>
    Object.values(node.inputs)
      .filter((v): v is [string, number] => Array.isArray(v) && typeof v[0] === "string" && typeof v[1] === "number")
      .map(([id]) => id)
      .filter((id) => !graph[id]),
  );
}

describe("buildEditGraph", () => {
  it.each(["qwen", "qwen_turbo"] as const)("%s: ноды — ровно из требований проверки готовности, ссылки целы", (model) => {
    const graph = buildEditGraph({ ...BASE, model });
    const required = MODEL_REQUIREMENTS.find((r) => r.id === model)!.nodes;
    expect(classTypes(graph).sort()).toEqual([...required].sort());
    expect(danglingLinks(graph)).toEqual([]);
  });

  it("файлы моделей — из требований", () => {
    const graph = buildEditGraph({ ...BASE, model: "qwen_turbo" });
    expect(graph.unet!.inputs.unet_name).toBe("qwen_image_2.1_turbo_int8_convrot.safetensors");
    expect(graph.clip!.inputs).toMatchObject({ clip_name: "qwen3vl_8b_int8_convrot.safetensors", type: "qwen_image" });
  });

  it("картинки подключены к энкодеру по порядку как images.image_N", () => {
    const graph = buildEditGraph({ ...BASE, model: "qwen" });
    expect(graph.image_1!.inputs.image).toBe("tg-rp-bot/a.png");
    expect(graph.encode!.inputs["images.image_1"]).toEqual(["image_1", 0]);
    expect(graph.encode!.inputs["images.image_2"]).toEqual(["image_2", 0]);
    expect(graph.encode!.inputs["images.image_3"]).toBeUndefined();
  });

  it("обычная: KSampler 45 шагов, CFG 1, seed без потерь; Turbo: сигмы графа 8", () => {
    const qwen = buildEditGraph({ ...BASE, model: "qwen" });
    expect(qwen.sample!.inputs).toMatchObject({ steps: 45, cfg: 1, seed: 891836227295375, sampler_name: "euler", scheduler: "simple" });
    const turbo = buildEditGraph({ ...BASE, model: "qwen_turbo" });
    expect(turbo.sigmas!.inputs.sigmas).toBe(TURBO_SIGMAS);
    expect(turbo.noise!.inputs.noise_seed).toBe(891836227295375);
  });

  it("без картинок — ошибка", () => {
    expect(() => buildEditGraph({ ...BASE, images: [], model: "qwen" })).toThrow();
  });
});

describe("maxImageTag / randomSeed", () => {
  it("находит наибольший номер тега", () => {
    expect(maxImageTag("без тегов")).toBe(0);
    expect(maxImageTag("<image2> и <image1>, <image3>")).toBe(3);
    expect(maxImageTag("<image_1> <IMAGE2>")).toBe(0);
  });

  it("seed — целое в пределах безопасного", () => {
    expect(randomSeed(() => 0.999999999)).toBeLessThanOrEqual(Number.MAX_SAFE_INTEGER);
    expect(Number.isSafeInteger(randomSeed())).toBe(true);
  });
});
