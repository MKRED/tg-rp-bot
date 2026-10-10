import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { ThrottlerModule } from "@nestjs/throttler";
import { UsersModule } from "../users/users.module.js";
import { AuthController } from "./auth.controller.js";
import { AuthGuard } from "./auth.guard.js";
import { AuthService } from "./auth.service.js";
import { SessionsRepository } from "./session/sessions.repository.js";
import { SessionsService } from "./session/sessions.service.js";

/**
 * Авторизация API: guard подключён глобально — каждый контроллер Nest закрыт по умолчанию. Вход —
 * по initData (Mini App) или по cookie сессии (браузер, логин и пароль).
 */
@Module({
  imports: [
    UsersModule,
    // Лимит попыток регистрации/входа с одного IP (ThrottlerGuard в AuthController): 10 в минуту.
    ThrottlerModule.forRoot({ throttlers: [{ ttl: 60_000, limit: 10 }] }),
  ],
  controllers: [AuthController],
  providers: [AuthService, SessionsService, SessionsRepository, { provide: APP_GUARD, useClass: AuthGuard }],
})
export class AuthModule {}
