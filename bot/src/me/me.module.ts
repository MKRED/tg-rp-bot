import { Module } from "@nestjs/common";
import { TelegramModule } from "../telegram/telegram.module.js";
import { MeController } from "./me.controller.js";
import { MeService } from "./me.service.js";
import { LightboxPhotoService } from "./media/lightbox-photo/lightbox-photo.service.js";
import { ProfilePhotoService } from "./media/profile-photo/profile-photo.service.js";

/** /api/me — профиль, фото профиля и отправка фото в личку (Bot API, см. media/). */
@Module({
  imports: [TelegramModule],
  controllers: [MeController],
  providers: [MeService, ProfilePhotoService, LightboxPhotoService],
})
export class MeModule {}
