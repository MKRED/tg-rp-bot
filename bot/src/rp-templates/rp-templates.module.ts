import { Module } from "@nestjs/common";
import { RpTemplatesController } from "./rp-templates.controller.js";
import { RpTemplatesRepository } from "./rp-templates.repository.js";
import { RpTemplatesService } from "./rp-templates.service.js";

@Module({
  controllers: [RpTemplatesController],
  providers: [RpTemplatesService, RpTemplatesRepository],
  exports: [RpTemplatesRepository],
})
export class RpTemplatesModule {}
