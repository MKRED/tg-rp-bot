import { Module } from "@nestjs/common";
import { PersonasController } from "./personas.controller.js";
import { PersonasRepository } from "./personas.repository.js";
import { PersonasService } from "./personas.service.js";

@Module({
  controllers: [PersonasController],
  providers: [PersonasService, PersonasRepository],
  exports: [PersonasRepository],
})
export class PersonasModule {}
