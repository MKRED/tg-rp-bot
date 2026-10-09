import { Module } from "@nestjs/common";
import { DebugController } from "./debug.controller.js";
import { DebugRepository } from "./debug.repository.js";
import { DebugService } from "./debug.service.js";

@Module({
  controllers: [DebugController],
  providers: [DebugService, DebugRepository],
})
export class DebugModule {}
