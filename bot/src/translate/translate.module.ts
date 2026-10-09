import { Module } from "@nestjs/common";
import { SettingsModule } from "../settings/settings.module.js";
import { TranslateController } from "./translate.controller.js";
import { TranslateService } from "./translate.service.js";

/** /api/translate — безэнтитный перевод (движок в engine/ — общий с переводом в чатах/историях). */
@Module({
  imports: [SettingsModule],
  controllers: [TranslateController],
  providers: [TranslateService],
})
export class TranslateModule {}
