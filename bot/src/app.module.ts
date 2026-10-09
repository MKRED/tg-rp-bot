import { Module } from "@nestjs/common";
import { APP_FILTER, APP_PIPE } from "@nestjs/core";
import { LoggerModule } from "nestjs-pino";
import { AuthModule } from "./auth/auth.module.js";
import { CharactersModule } from "./characters/characters.module.js";
import { ApiExceptionFilter } from "./common/api-exception.filter.js";
import { createValidationPipe } from "./common/validation-pipe.js";
import { DatabaseModule } from "./database/database.module.js";
import logger from "./logger.js";
import { PersonasModule } from "./personas/personas.module.js";

@Module({
  imports: [
    // Nest пишет в тот же pino-логгер, что и остальной код (logger.ts: файл + pretty в TTY).
    // autoLogging выключен: доменные сервисы сами логируют операции с длительностью (CLAUDE.md),
    // построчный лог каждого запроса дублировал бы их.
    LoggerModule.forRoot({ pinoHttp: { logger, autoLogging: false } }),
    DatabaseModule,
    AuthModule,
    CharactersModule,
    PersonasModule,
  ],
  providers: [
    { provide: APP_PIPE, useFactory: createValidationPipe },
    { provide: APP_FILTER, useClass: ApiExceptionFilter },
  ],
})
export class AppModule {}
