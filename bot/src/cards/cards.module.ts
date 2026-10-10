import { Module } from "@nestjs/common";
import { LlmModule } from "../llm/llm.module.js";
import { PresetsModule } from "../presets/presets.module.js";
import { SettingsModule } from "../settings/settings.module.js";
import { TavilyModule } from "../tavily/tavily.module.js";
import { CardsController } from "./cards.controller.js";
import { CardsRepository } from "./cards.repository.js";
import { CardsService } from "./cards.service.js";
import { CardGenerationService } from "./generation/card-generation.service.js";

@Module({
  imports: [LlmModule, PresetsModule, SettingsModule, TavilyModule],
  controllers: [CardsController],
  providers: [CardsService, CardsRepository, CardGenerationService],
})
export class CardsModule {}
