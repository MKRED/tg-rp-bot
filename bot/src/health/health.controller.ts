import { Controller, Get } from "@nestjs/common";
import { Public } from "../auth/public.decorator.js";

/** GET /health (вне префикса /api, см. main.ts) — проверка доступности для мониторинга, без авторизации. */
@Controller("health")
export class HealthController {
  @Public()
  @Get()
  check(): { ok: true } {
    return { ok: true };
  }
}
