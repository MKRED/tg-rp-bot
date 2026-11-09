import { BadRequestException, ConflictException, HttpException, Injectable, type OnApplicationBootstrap } from "@nestjs/common";
import { ComfyAgentService } from "../../comfy-agent/comfy-agent.service.js";
import { config } from "../../config.js";
import logger from "../../logger.js";
import { toDataUrl, pngSize } from "../comfy/data-url.js";
import { buildEditGraph, maxImageTag, randomSeed } from "../graph/edit-graph.js";
import { ImageCanvasItemsRepository } from "../image-canvas-items.repository.js";
import { ImageCanvasRepository, type CanvasRecord, type GenerationRequest } from "../image-canvas.repository.js";
import { COMFY_SUBFOLDER, ComfyApi } from "./comfy-api.js";

/** Как часто спрашивать ComfyUI о задании. */
const POLL_INTERVAL_MS = 2000;
/**
 * Сколько ждать результат. Первый запуск грузит модели (десятки секунд), задание может стоять в
 * очереди за чужими — с запасом.
 */
const GENERATION_DEADLINE_MS = 20 * 60_000;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Генерация на холсте. Сервер ведёт задание сам: ставит граф в очередь ComfyUI, хранит prompt_id в
 * БД и опрашивает history, пока не будет результата; результат записывается черновиком. Браузер только
 * опрашивает состояние холста — закрытая вкладка генерацию не прерывает. После перезапуска бота
 * (деплой) слежение за идущими заданиями возобновляется: ComfyUI на ПК продолжает работать.
 */
@Injectable()
export class CanvasGenerationService implements OnApplicationBootstrap {
  private readonly comfy: ComfyApi;
  /** Холсты, для которых идёт запуск или слежение в этом процессе (canvasId). */
  private readonly active = new Set<number>();
  /** Отменённые пользователем: слежение завершается, результат (если успеет) не записывается. */
  private readonly cancelled = new Set<number>();

  constructor(
    agents: ComfyAgentService,
    private readonly canvases: ImageCanvasRepository,
    private readonly items: ImageCanvasItemsRepository,
  ) {
    this.comfy = new ComfyApi(agents);
  }

  onApplicationBootstrap(): void {
    // Локальный `yarn dev` смотрит в прод-БД, но агенты подключены к проду, а не к нему: локальное
    // слежение получало бы «агент офлайн» и в итоге записало бы ошибку в чужую идущую генерацию.
    if (!config.isProduction) return;
    this.canvases
      .findRunning()
      .then((running) => {
        for (const canvas of running) {
          if (!canvas.genPromptId || !canvas.genRequest) continue;
          logger.info({ userId: canvas.userId, canvasId: canvas.id, promptId: canvas.genPromptId }, "Resuming image generation watch");
          this.watch(canvas.userId, canvas.id, canvas.genPromptId, canvas.genRequest, canvas.genStartedAt ?? new Date());
        }
      })
      .catch((err) => logger.error({ err }, "Failed to resume image generations"));
  }

  /** Запуск: загрузка картинок в ComfyUI, граф, постановка в очередь. Дальше — слежение в фоне. */
  async start(userId: string, canvas: CanvasRecord, references: string[]): Promise<void> {
    const prompt = canvas.prompt.trim();
    if (references.length === 0) throw new BadRequestException("Прикрепите картинку, которую нужно изменить");
    if (!prompt) throw new BadRequestException("Напишите, что сделать с картинкой");
    const maxTag = maxImageTag(prompt);
    if (maxTag > references.length) {
      throw new BadRequestException(`В промпте есть <image${maxTag}>, а картинок прикреплено ${references.length}`);
    }
    if (canvas.genStatus === "running" || this.active.has(canvas.id)) {
      throw new ConflictException("Генерация на этом холсте уже идёт");
    }

    this.active.add(canvas.id);
    this.cancelled.delete(canvas.id);
    const t0 = Date.now();
    try {
      const images: string[] = [];
      for (const reference of references) images.push(await this.comfy.upload(userId, reference));
      const request: GenerationRequest = { model: canvas.model, prompt, seed: randomSeed() };
      const graph = buildEditGraph({ ...request, images, filenamePrefix: `${COMFY_SUBFOLDER}/canvas` });
      const promptId = await this.comfy.submit(userId, graph);
      const startedAt = new Date();
      await this.canvases.setGeneration(userId, canvas.id, {
        genStatus: "running",
        genPromptId: promptId,
        genStartedAt: startedAt,
        genError: null,
        genRequest: request,
      });
      logger.info(
        { userId, canvasId: canvas.id, promptId, model: request.model, images: images.length, durationMs: Date.now() - t0 },
        "Image generation queued",
      );
      this.watch(userId, canvas.id, promptId, request, startedAt);
    } catch (err) {
      this.active.delete(canvas.id);
      logger.warn({ err, userId, canvasId: canvas.id, durationMs: Date.now() - t0 }, "Image generation failed to start");
      throw err;
    }
  }

  /** Отмена: убрать задание из ComfyUI и вернуть холст в покой. Агент недоступен — всё равно в покой. */
  async cancel(userId: string, canvas: CanvasRecord): Promise<void> {
    if (canvas.genStatus !== "running" || !canvas.genPromptId) return;
    this.cancelled.add(canvas.id);
    try {
      const position = await this.comfy.cancel(userId, canvas.genPromptId);
      logger.info({ userId, canvasId: canvas.id, promptId: canvas.genPromptId, position }, "Image generation cancelled");
    } catch (err) {
      // Задание могло остаться в ComfyUI, но его результат уже не запишется (cancelled).
      logger.warn({ err, userId, canvasId: canvas.id }, "Image generation cancel did not reach ComfyUI");
    }
    await this.canvases.setGeneration(userId, canvas.id, idle());
  }

  private watch(userId: string, canvasId: number, promptId: string, request: GenerationRequest, startedAt: Date): void {
    this.active.add(canvasId);
    this.follow(userId, canvasId, promptId, request, startedAt)
      .catch((err) => logger.error({ err, userId, canvasId, promptId }, "Image generation watch crashed"))
      .finally(() => {
        this.active.delete(canvasId);
        this.cancelled.delete(canvasId);
      });
  }

  private async follow(userId: string, canvasId: number, promptId: string, request: GenerationRequest, startedAt: Date): Promise<void> {
    const deadline = startedAt.getTime() + GENERATION_DEADLINE_MS;
    while (Date.now() < deadline) {
      await sleep(POLL_INTERVAL_MS);
      if (this.cancelled.has(canvasId)) return;
      let state;
      try {
        state = await this.comfy.history(userId, promptId);
      } catch (err) {
        // Агент мог на время пропасть (перезапуск ПК, сеть) — ждём до дедлайна.
        logger.debug({ err, userId, canvasId, promptId }, "Image generation poll failed, retrying");
        continue;
      }
      if (this.cancelled.has(canvasId)) return;
      if (state.state === "pending") continue;
      if (state.state === "error") {
        await this.canvases.setGeneration(userId, canvasId, state.interrupted ? idle() : failed(state.message));
        logger.warn({ userId, canvasId, promptId, message: state.message }, "Image generation failed in ComfyUI");
        return;
      }
      await this.saveResult(userId, canvasId, promptId, request, state.images, startedAt);
      return;
    }
    await this.canvases.setGeneration(userId, canvasId, failed("Не дождались результата: проверьте, что ComfyUI и агент на ПК работают"));
    logger.warn({ userId, canvasId, promptId }, "Image generation timed out");
  }

  private async saveResult(
    userId: string,
    canvasId: number,
    promptId: string,
    request: GenerationRequest,
    images: Array<{ filename: string; subfolder: string; type: string }>,
    startedAt: Date,
  ): Promise<void> {
    const output = images[0];
    if (!output) {
      await this.canvases.setGeneration(userId, canvasId, failed("ComfyUI не вернул картинку"));
      return;
    }
    try {
      const data = await this.comfy.download(userId, output);
      if (this.cancelled.has(canvasId)) return;
      const size = pngSize(data);
      await this.items.insertDraft(userId, canvasId, {
        image: toDataUrl("image/png", data),
        prompt: request.prompt,
        model: request.model,
        seed: request.seed,
        width: size?.width ?? null,
        height: size?.height ?? null,
      });
      await this.canvases.setGeneration(userId, canvasId, idle());
      logger.info(
        { userId, canvasId, promptId, bytes: data.length, durationMs: Date.now() - startedAt.getTime() },
        "Image generation finished",
      );
    } catch (err) {
      logger.error({ err, userId, canvasId, promptId }, "Failed to save image generation result");
      const message = err instanceof HttpException ? describe(err) : "Не удалось сохранить результат";
      await this.canvases.setGeneration(userId, canvasId, failed(message)).catch((e) =>
        logger.error({ err: e, userId, canvasId }, "Failed to record image generation error"),
      );
    }
  }
}

function idle() {
  return { genStatus: "idle" as const, genPromptId: null, genStartedAt: null, genError: null, genRequest: null };
}

function failed(message: string) {
  return { genStatus: "error" as const, genPromptId: null, genStartedAt: null, genError: message, genRequest: null };
}

function describe(err: HttpException): string {
  const body = err.getResponse();
  return typeof body === "object" && body && "message" in body ? String((body as { message: unknown }).message) : err.message;
}
