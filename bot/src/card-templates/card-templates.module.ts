import { Module } from "@nestjs/common";
import { CardTemplatesController } from "./card-templates.controller.js";
import { CardTemplatesRepository } from "./card-templates.repository.js";
import { CardTemplatesService } from "./card-templates.service.js";

@Module({
  controllers: [CardTemplatesController],
  providers: [CardTemplatesService, CardTemplatesRepository],
})
export class CardTemplatesModule {}
