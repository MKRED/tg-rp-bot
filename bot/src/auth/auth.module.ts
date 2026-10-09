import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { UsersModule } from "../users/users.module.js";
import { TelegramAuthGuard } from "./telegram-auth.guard.js";

/** Авторизация API: guard подключён глобально — каждый контроллер Nest закрыт по умолчанию. */
@Module({
  imports: [UsersModule],
  providers: [{ provide: APP_GUARD, useClass: TelegramAuthGuard }],
})
export class AuthModule {}
