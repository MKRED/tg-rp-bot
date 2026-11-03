import { Module } from "@nestjs/common";
import { CardsModule } from "../cards/cards.module.js";
import { LlmModule } from "../llm/llm.module.js";
import { PresetsModule } from "../presets/presets.module.js";
import { SettingsModule } from "../settings/settings.module.js";
import { WebSearchModule } from "../web-search/web-search.module.js";
import { CoauthorTurnService } from "./coauthor-turn.service.js";
import { CoauthorController } from "./coauthor.controller.js";
import { CoauthorRepository } from "./coauthor.repository.js";
import { CoauthorService } from "./coauthor.service.js";

@Module({
  imports: [CardsModule, LlmModule, PresetsModule, SettingsModule, WebSearchModule],
  controllers: [CoauthorController],
  providers: [CoauthorService, CoauthorTurnService, CoauthorRepository],
})
export class CoauthorModule {}
