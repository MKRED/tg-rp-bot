import { Body, Controller, Delete, Get, Patch } from "@nestjs/common";
import { CurrentUser } from "../auth/current-user.decorator.js";
import { DebugService } from "./debug.service.js";
import { LlmDebugSettingsPatchDto } from "./dto/llm-debug-settings-patch.dto.js";

/**
 * /api/debug/llm — RAW-запросы к LLM текущего пользователя и управление перехватом. Всё изолировано
 * по владельцу. Форма ответов (`{ settings, records }`, `{ settings }`, `{ ok: true }`) — контракт webapp.
 */
@Controller("debug/llm")
export class DebugController {
  constructor(private readonly debug: DebugService) {}

  @Get()
  view(@CurrentUser() userId: number) {
    return this.debug.view(userId);
  }

  @Patch("settings")
  async updateSettings(@CurrentUser() userId: number, @Body() patch: LlmDebugSettingsPatchDto) {
    return { settings: await this.debug.updateSettings(userId, patch) };
  }

  @Delete("records")
  clearRecords(@CurrentUser() userId: number) {
    this.debug.clearRecords(userId);
    return { ok: true };
  }
}
