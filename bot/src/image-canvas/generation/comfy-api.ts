import { createHash } from "node:crypto";
import { BadGatewayException, BadRequestException } from "@nestjs/common";
import { ComfyAgentService, parseJsonBody } from "../../comfy-agent/comfy-agent.service.js";
import { decodeImageDataUrl, extensionFor } from "../comfy/data-url.js";
import { buildMultipart } from "../comfy/multipart.js";
import type { ComfyGraph } from "../graph/edit-graph.js";
import { parseHistory, promptRejection, queuePosition, type HistoryState, type OutputImage } from "./comfy-responses.js";

/** Подпапка в input и output ComfyUI для файлов приложения — не смешиваются с файлами пользователя. */
export const COMFY_SUBFOLDER = "tg-rp-bot";
/** Загрузка и скачивание картинки через агента — дольше обычного запроса (~2 МБ в каждую сторону). */
const FILE_TIMEOUT_MS = 60_000;

/**
 * Вызовы ComfyUI для генерации через агента. Не Nest-провайдер: сервис генерации передаёт
 * ComfyAgentService сам (тот же, что внедрён в него).
 */
export class ComfyApi {
  constructor(private readonly agents: ComfyAgentService) {}

  /**
   * Загружает картинку в input ComfyUI и возвращает путь для LoadImage. Имя — хеш содержимого:
   * повторная генерация с той же картинкой перезаписывает файл, а не плодит копии. Путь берём из
   * ответа ComfyUI (он может переименовать файл), а не из отправленного.
   */
  async upload(userId: string, dataUrl: string): Promise<string> {
    const decoded = decodeImageDataUrl(dataUrl);
    if (!decoded) throw new BadRequestException("Картинка повреждена — прикрепите её заново");
    const name = `${createHash("sha256").update(decoded.data).digest("hex").slice(0, 24)}.${extensionFor(decoded.mime)}`;
    const { body, contentType } = buildMultipart({ subfolder: COMFY_SUBFOLDER, type: "input", overwrite: "true" }, [
      { field: "image", filename: name, contentType: decoded.mime, data: decoded.data },
    ]);
    const res = await this.agents.callComfyJson<{ name?: string; subfolder?: string }>(
      userId,
      { method: "POST", path: "/api/upload/image", body: { data: body, contentType } },
      FILE_TIMEOUT_MS,
    );
    if (!res.name) throw new BadGatewayException({ error: "comfy_error", message: "ComfyUI не принял картинку" });
    return res.subfolder ? `${res.subfolder}/${res.name}` : res.name;
  }

  /** Ставит граф в очередь; отказ ComfyUI (нет ноды, файла модели…) — понятной ошибкой. */
  async submit(userId: string, graph: ComfyGraph): Promise<string> {
    const res = await this.agents.callComfy(userId, { method: "POST", path: "/api/prompt", json: { prompt: graph }, acceptErrorStatus: true });
    const body = parseJsonBody<{ prompt_id?: string }>(res);
    if (res.status >= 400 || !body.prompt_id) {
      throw new BadGatewayException({ error: "comfy_error", message: `ComfyUI отклонил задание: ${promptRejection(body)}` });
    }
    return body.prompt_id;
  }

  async history(userId: string, promptId: string): Promise<HistoryState> {
    const body = await this.agents.callComfyJson<unknown>(userId, { method: "GET", path: `/api/history/${promptId}` });
    return parseHistory(body, promptId);
  }

  async download(userId: string, image: OutputImage): Promise<Buffer> {
    const res = await this.agents.callComfy(
      userId,
      { method: "GET", path: "/api/view", query: { filename: image.filename, subfolder: image.subfolder, type: image.type } },
      FILE_TIMEOUT_MS,
    );
    return Buffer.from(res.bodyBase64, "base64");
  }

  /**
   * Отменяет своё задание: идущее — interrupt с prompt_id (чужое задание пользователя не трогаем),
   * ждущее — удаляет из очереди. Нет в очереди — уже закончилось или не начиналось.
   */
  async cancel(userId: string, promptId: string): Promise<"running" | "pending" | "absent"> {
    const queue = await this.agents.callComfyJson<unknown>(userId, { method: "GET", path: "/api/queue" });
    const position = queuePosition(queue, promptId);
    if (position === "running") {
      await this.agents.callComfy(userId, { method: "POST", path: "/api/interrupt", json: { prompt_id: promptId } });
    } else if (position === "pending") {
      await this.agents.callComfy(userId, { method: "POST", path: "/api/queue", json: { delete: [promptId] } });
    }
    return position;
  }
}
