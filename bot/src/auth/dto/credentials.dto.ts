import {
  type AuthCredentials,
  LOGIN_MAX_LENGTH,
  LOGIN_MIN_LENGTH,
  LOGIN_RE,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
} from "@tg-rp-bot/shared";
import { Transform } from "class-transformer";
import { IsString, Length, Matches } from "class-validator";

const LOGIN_MESSAGE = `Login must be ${LOGIN_MIN_LENGTH}–${LOGIN_MAX_LENGTH} characters: a-z, 0-9, _ . -`;
const PASSWORD_MESSAGE = `Password must be ${PASSWORD_MIN_LENGTH}–${PASSWORD_MAX_LENGTH} characters`;

/** Тело POST /api/auth/register и /api/auth/login. Логин приводится к нижнему регистру. */
export class CredentialsDto implements AuthCredentials {
  @Transform(({ value }) => (typeof value === "string" ? value.trim().toLowerCase() : value))
  @IsString({ message: LOGIN_MESSAGE })
  @Matches(LOGIN_RE, { message: LOGIN_MESSAGE })
  login!: string;

  // Пароль не обрезается: пробелы по краям — часть пароля.
  @IsString({ message: PASSWORD_MESSAGE })
  @Length(PASSWORD_MIN_LENGTH, PASSWORD_MAX_LENGTH, { message: PASSWORD_MESSAGE })
  password!: string;
}
