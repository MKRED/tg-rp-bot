import { Module } from "@nestjs/common";
import { AvatarsController } from "./avatars.controller.js";
import { AvatarsRepository } from "./avatars.repository.js";
import { AvatarsService } from "./avatars.service.js";

/** /api/avatars — батч-резолв картинок персонажей и персон для AvatarStack. */
@Module({
  controllers: [AvatarsController],
  providers: [AvatarsService, AvatarsRepository],
})
export class AvatarsModule {}
