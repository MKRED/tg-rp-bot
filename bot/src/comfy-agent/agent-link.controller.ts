import { Body, Controller, Get, Header, Headers, HttpCode, Param, ParseUUIDPipe, Post, Query, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { Public } from "../auth/public.decorator.js";
import { ComfyAgentService } from "./comfy-agent.service.js";
import { AgentResultDto } from "./dto/agent-result.dto.js";
import { agentScript, installerScript } from "./install/index.js";

const POWERSHELL_TEXT = "text/plain; charset=utf-8";

/**
 * /api/comfy-agent/agent — сторона агента на ПК. @Public: у агента нет ни initData, ни cookie
 * сессии, он входит своим токеном (Authorization: Bearer), который проверяет сервис. CSRF-заголовок
 * AuthGuard требует и здесь — агент его отправляет. Установщик и сам агент тоже здесь: их скачивает
 * PowerShell без входа (`irm ... | iex`); установщик выдаётся только по одноразовому коду.
 */
@Public()
@Controller("comfy-agent/agent")
export class AgentLinkController {
  constructor(private readonly agents: ComfyAgentService) {}

  /** Long-poll: задания сразу или пустой список через ~20 с. */
  @Get("poll")
  async poll(
    @Headers("authorization") authorization: string | undefined,
    @Headers("x-agent-version") versionHeader: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ) {
    const userId = await this.agents.authenticateAgent(authorization);
    // Соединение оборвалось до ответа — задания не должны уйти в закрытый сокет.
    const aborted = new AbortController();
    res.on("close", () => {
      if (!res.writableFinished) aborted.abort();
    });
    const version = Number.parseInt(versionHeader ?? "", 10);
    return { jobs: await this.agents.poll(userId, aborted.signal, Number.isFinite(version) ? version : 1) };
  }

  @Post("result/:id")
  @HttpCode(200)
  async result(
    @Headers("authorization") authorization: string | undefined,
    @Param("id", ParseUUIDPipe) jobId: string,
    @Body() body: AgentResultDto,
  ) {
    const userId = await this.agents.authenticateAgent(authorization);
    return this.agents.complete(userId, jobId, body);
  }

  /**
   * Установщик по одноразовому коду (`irm .../install?c=... | iex`). Всегда 200 и текст PowerShell:
   * на ошибочный статус `irm` вывел бы непонятное исключение вместо нашей подсказки.
   */
  @Get("install")
  @Header("Content-Type", POWERSHELL_TEXT)
  @Header("Cache-Control", "no-store")
  async install(@Query("c") code: string | undefined, @Req() req: Request): Promise<string> {
    const token = code ? await this.agents.redeemInstallCode(code) : null;
    if (!token) {
      return 'Write-Host "Команда установки устарела или уже использована. Получите новую в приложении: Настройки → ComfyUI." -ForegroundColor Red\n';
    }
    // Адрес — тот, по которому пришёл PowerShell (trust proxy 1 → https за nginx): так же работает и локально.
    return installerScript(`${req.protocol}://${req.get("host")}`, token);
  }

  /** Сам агент — его скачивает установщик. Секретов в нём нет. */
  @Get("script")
  @Header("Content-Type", POWERSHELL_TEXT)
  @Header("Cache-Control", "no-store")
  script(): string {
    return agentScript();
  }
}
