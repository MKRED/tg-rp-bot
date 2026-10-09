import { Module } from "@nestjs/common";
import { PresetsModule } from "../presets/presets.module.js";
import { CardsController } from "./cards.controller.js";
import { CardsRepository } from "./cards.repository.js";
import { CardsService } from "./cards.service.js";
import { CardGenerationService } from "./generation/card-generation.service.js";

@Module({
  imports: [PresetsModule],
  controllers: [CardsController],
  providers: [CardsService, CardsRepository, CardGenerationService],
})
export class CardsModule {}
