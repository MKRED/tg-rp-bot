import { Module } from "@nestjs/common";
import { LlmModule } from "../llm/llm.module.js";
import { SettingsModule } from "../settings/settings.module.js";
import { TranslateController } from "./translate.controller.js";
import { TranslateService } from "./translate.service.js";

/** /api/translate — безэнтитный перевод (движок в engine/ — общий с переводом в чатах/историях). */
@Module({
  imports: [LlmModule, SettingsModule],
  controllers: [TranslateController],
  providers: [TranslateService],
})
export class TranslateModule {}
