import { type BookInput, MAX_BOOK_DESCRIPTION_LENGTH, MAX_BOOK_NAME_LENGTH } from "@tg-rp-bot/shared";
import { Transform } from "class-transformer";
import { IsNotEmpty, IsOptional, IsString } from "class-validator";

/** Тело POST/PUT /books. Длинные поля обрезаются, а не отклоняются; пустое описание — null. */
export class BookInputDto implements BookInput {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === "string" ? value.trim().slice(0, MAX_BOOK_NAME_LENGTH) : "",
  )
  @IsNotEmpty({ message: "Name is required" })
  name!: string;

  @Transform(({ value }: { value: unknown }) =>
    typeof value === "string" && value.trim() ? value.trim().slice(0, MAX_BOOK_DESCRIPTION_LENGTH) : null,
  )
  @IsOptional()
  @IsString()
  description: string | null = null;
}
