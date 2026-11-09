import {
  BadGatewayException,
  GatewayTimeoutException,
  type HttpException,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from "@nestjs/common";
import type { ComfyAgentErrorCode, ComfyAgentInstallCode, ComfyAgentStatus } from "@tg-rp-bot/shared";
import logger from "../logger.js";
import { generateAgentToken, hashAgentToken, parseAgentBearer } from "./agent-token.js";
import { ComfyAgentRepository } from "./comfy-agent.repository.js";
import { isAllowedComfyRequest } from "./comfy-paths.js";
import { InstallCodes } from "./install/index.js";
import {
  AgentOfflineError,
  AgentTimeoutError,
  RelayHub,
  type AgentJob,
  type AgentJobRequest,
  type AgentResponse,
} from "./relay/index.js";

/**
 * Связь с ComfyUI пользователя через агента на его ПК: выпуск токена, вход агента, передача
 * запросов. Другие модули (позже — редактирование картинок) ходят в ComfyUI только через callComfy.
 */
@Injectable()
export class ComfyAgentService {
  constructor(
    private readonly repository: ComfyAgentRepository,
    private readonly hub: RelayHub,
    private readonly installCodes: InstallCodes,
  ) {}

  async status(userId: string): Promise<ComfyAgentStatus> {
    const lastSeen = this.hub.lastSeen(userId);
    return {
      hasToken: await this.repository.hasToken(userId),
      online: this.hub.isOnline(userId),
      lastSeenAt: lastSeen === null ? null : new Date(lastSeen).toISOString(),
    };
  }

  /**
   * Код для команды установки. Токен ещё не меняется: прежний агент работает, пока команду не выполнят.
   */
  issueInstallCode(userId: string): ComfyAgentInstallCode {
    const { code, expiresAt } = this.installCodes.issue(userId);
    logger.info({ userId }, "Comfy agent install code issued");
    return { code, expiresAt: new Date(expiresAt).toISOString() };
  }

  /**
   * Обмен кода на новый токен — в момент установки. Прежний агент отключается сразу (его токен
   * больше не найдётся в БД). null — код неизвестен, истёк или уже использован.
   */
  async redeemInstallCode(code: string): Promise<string | null> {
    const userId = this.installCodes.redeem(code);
    if (!userId) {
      logger.warn("Comfy agent install code rejected");
      return null;
    }
    const token = generateAgentToken();
    await this.repository.setTokenHash(userId, hashAgentToken(token));
    this.hub.drop(userId);
    logger.info({ userId }, "Comfy agent installed with a new token");
    return token;
  }

  async revokeToken(userId: string): Promise<{ ok: true }> {
    await this.repository.setTokenHash(userId, null);
    this.hub.drop(userId);
    return { ok: true };
  }

  /** Пользователь агента по заголовку Authorization; иначе 401. */
  async authenticateAgent(authorization: string | undefined): Promise<string> {
    const token = parseAgentBearer(authorization);
    const userId = token ? await this.repository.findUserIdByTokenHash(hashAgentToken(token)) : null;
    if (!userId) {
      logger.warn({ hasHeader: Boolean(authorization) }, "Comfy agent rejected: unknown token");
      throw new UnauthorizedException("Unknown agent token");
    }
    return userId;
  }

  async poll(userId: string, signal: AbortSignal): Promise<AgentJob[]> {
    if (!this.hub.isOnline(userId)) logger.info({ userId }, "Comfy agent connected");
    const jobs = await this.hub.poll(userId, signal);
    if (jobs.length > 0) logger.debug({ userId, jobIds: jobs.map((j) => j.id) }, "Comfy agent took jobs");
    return jobs;
  }

  complete(userId: string, jobId: string, res: AgentResponse): { ok: boolean } {
    const ok = this.hub.complete(userId, jobId, res);
    if (!ok) logger.warn({ userId, jobId }, "Comfy agent answered an unknown or expired job");
    return { ok };
  }

  /**
   * Запрос к ComfyUI пользователя. Офлайн, таймаут и ошибки ComfyUI — понятные HTTP-ошибки.
   * Тело сериализуем здесь: агент на PowerShell 5.1 только пересылает байты, а его собственная
   * пересборка JSON теряла бы точность больших чисел (seed) и портила массивы.
   */
  async callComfy(userId: string, req: ComfyRequest, timeoutMs?: number): Promise<AgentResponse> {
    // Список проверяет и агент; здесь — чтобы ошибка в нашем же коде всплыла сразу, а не на ПК.
    if (!isAllowedComfyRequest(req.method, req.path)) {
      throw new Error(`ComfyUI request is not allowed: ${req.method} ${req.path}`);
    }
    const t0 = Date.now();
    let res: AgentResponse;
    try {
      res = await this.hub.request(userId, toJobRequest(req), timeoutMs);
    } catch (err) {
      logger.warn({ err, userId, path: req.path, durationMs: Date.now() - t0 }, "ComfyUI request via agent failed");
      throw toHttpError(err);
    }
    logger.info({ userId, path: req.path, status: res.status, durationMs: Date.now() - t0 }, "ComfyUI request via agent done");
    if (res.status === 0) throw comfyError("comfy_unreachable", 502, `Агент не смог подключиться к ComfyUI: ${res.error ?? "нет ответа"}`);
    if (res.status >= 400) throw comfyError("comfy_error", 502, `ComfyUI ответил ошибкой ${res.status}`);
    return res;
  }

  async callComfyJson<T>(userId: string, req: ComfyRequest, timeoutMs?: number): Promise<T> {
    const res = await this.callComfy(userId, req, timeoutMs);
    return JSON.parse(Buffer.from(res.bodyBase64, "base64").toString("utf8")) as T;
  }

  /** Проверка цепочки целиком: сервер → агент → ComfyUI. */
  systemStats(userId: string): Promise<unknown> {
    return this.callComfyJson(userId, { method: "GET", path: "/api/system_stats" });
  }
}

/** Запрос к ComfyUI со стороны кода сервера: JSON-тело — обычным объектом. */
export interface ComfyRequest extends Omit<AgentJobRequest, "bodyBase64" | "contentType"> {
  json?: unknown;
}

function toJobRequest({ json, ...rest }: ComfyRequest): AgentJobRequest {
  if (json === undefined) return rest;
  return { ...rest, contentType: "application/json", bodyBase64: Buffer.from(JSON.stringify(json)).toString("base64") };
}

function comfyError(code: ComfyAgentErrorCode, status: 502 | 503 | 504, message: string): HttpException {
  const body = { error: code, message };
  if (status === 503) return new ServiceUnavailableException(body);
  if (status === 504) return new GatewayTimeoutException(body);
  return new BadGatewayException(body);
}

function toHttpError(err: unknown): unknown {
  if (err instanceof AgentOfflineError) {
    return comfyError("comfy_agent_offline", 503, "Агент на ПК не подключён: запустите его и попробуйте снова");
  }
  if (err instanceof AgentTimeoutError) {
    return comfyError("comfy_agent_timeout", 504, "Агент на ПК не ответил вовремя");
  }
  return err;
}
