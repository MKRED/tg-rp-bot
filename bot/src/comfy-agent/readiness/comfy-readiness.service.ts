import { Injectable } from "@nestjs/common";
import type { ComfyReadiness } from "@tg-rp-bot/shared";
import logger from "../../logger.js";
import { ComfyAgentService } from "../comfy-agent.service.js";
import { evaluateReadiness, type ObjectInfoByNode } from "./evaluate-readiness.js";
import { requiredNodeTypes } from "./requirements.js";

/** Проверка ComfyUI пользователя: версия, видеокарта, нужные ноды и файлы моделей. */
@Injectable()
export class ComfyReadinessService {
  constructor(private readonly agents: ComfyAgentService) {}

  async check(userId: string): Promise<ComfyReadiness> {
    const t0 = Date.now();
    const nodes = requiredNodeTypes();
    // Запросы параллельно: агент забирает их одной пачкой, а у каждого прохода свой таймаут.
    // Полный /object_info не берём — это несколько мегабайт ради десятка нод.
    const [stats, ...infos] = await Promise.all([
      this.agents.systemStats(userId),
      ...nodes.map((node) =>
        this.agents.callComfyJson<Record<string, unknown>>(userId, { method: "GET", path: `/api/object_info/${node}` }),
      ),
    ]);
    const objectInfo: ObjectInfoByNode = Object.fromEntries(nodes.map((node, i) => [node, infos[i] as Record<string, unknown>]));
    const readiness = evaluateReadiness(stats, objectInfo);
    logger.info(
      {
        userId,
        durationMs: Date.now() - t0,
        comfyuiVersion: readiness.comfyuiVersion,
        ready: Object.fromEntries(readiness.models.map((m) => [m.id, m.ready])),
      },
      "ComfyUI readiness checked",
    );
    return readiness;
  }
}
