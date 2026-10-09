import { Module } from "@nestjs/common";
import { PresetsModule } from "../presets/presets.module.js";
import { CardGenerationService } from "./card-generation.service.js";
import { CardsController } from "./cards.controller.js";
import { CardsRepository } from "./cards.repository.js";
import { CardsService } from "./cards.service.js";

@Module({
  imports: [PresetsModule],
  controllers: [CardsController],
  providers: [CardsService, CardsRepository, CardGenerationService],
})
export class CardsModule {}
