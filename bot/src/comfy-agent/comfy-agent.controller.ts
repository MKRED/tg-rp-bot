import { Controller, Delete, Get, Post } from "@nestjs/common";
import { CurrentUser } from "../auth/current-user.decorator.js";
import { ComfyAgentService } from "./comfy-agent.service.js";
import { ComfyReadinessService } from "./readiness/index.js";

/** /api/comfy-agent — подключение агента ComfyUI со стороны приложения. */
@Controller("comfy-agent")
export class ComfyAgentController {
  constructor(
    private readonly agents: ComfyAgentService,
    private readonly readiness: ComfyReadinessService,
  ) {}

  @Get()
  status(@CurrentUser() userId: string) {
    return this.agents.status(userId);
  }

  /** 201 {code, expiresAt} — одноразовый код для команды установки агента. */
  @Post("install-code")
  issueInstallCode(@CurrentUser() userId: string) {
    return this.agents.issueInstallCode(userId);
  }

  /** Отключить ПК: токен удаляется, агент получает 401 и останавливается. */
  @Delete("token")
  revokeToken(@CurrentUser() userId: string) {
    return this.agents.revokeToken(userId);
  }

  /** Проверка ComfyUI: версия, видеокарта, ноды и файлы для каждой модели. */
  @Get("check")
  check(@CurrentUser() userId: string) {
    return this.readiness.check(userId);
  }
}
