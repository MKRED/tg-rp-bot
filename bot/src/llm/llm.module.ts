import { Module } from "@nestjs/common";
import { SettingsModule } from "../settings/settings.module.js";
import { LlmService } from "./llm.service.js";

/** Вызов LLM с персональным ключом пользователя — для генераций, сжатия и ИИ-перевода. */
@Module({
  imports: [SettingsModule],
  providers: [LlmService],
  exports: [LlmService],
})
export class LlmModule {}
