import { Module } from "@nestjs/common";
import { MeController } from "./me.controller.js";
import { MeService } from "./me.service.js";

/** /api/me — профиль, фото профиля и отправка фото в личку (Bot API, см. media/). */
@Module({
  controllers: [MeController],
  providers: [MeService],
})
export class MeModule {}
