import {
  DEFAULT_KEYWORD_DEPTH,
  ENTRY_ACTIVATIONS,
  type EntryActivation,
  type EntryInput,
  MAX_ENTRY_FIELD_LENGTH,
  MAX_KEYWORD_DEPTH,
  MIN_KEYWORD_DEPTH,
} from "@tg-rp-bot/shared";
import { Transform } from "class-transformer";
import { Allow, IsBoolean, IsIn, IsInt, IsNotEmpty, IsString, ValidateBy, type ValidationArguments } from "class-validator";

/** Обрезанная строка с потолком длины; не строка → "". */
const TrimmedField = () =>
  Transform(({ value }: { value: unknown }) =>
    typeof value === "string" ? value.trim().slice(0, MAX_ENTRY_FIELD_LENGTH) : "",
  );

/** Id ссылки: только число, иначе — ссылки нет. */
const ReferenceId = () => Transform(({ value }: { value: unknown }) => (typeof value === "number" ? value : null));

/** Правило, которому нужны соседние поля записи (поля уже нормализованы трансформами). */
const EntryRule = (name: string, message: string, check: (value: unknown, entry: EntryInput) => boolean) =>
  ValidateBy({
    name,
    validator: {
      validate: (value: unknown, args?: ValidationArguments) => check(value, args!.object as EntryInput),
      defaultMessage: () => message,
    },
  });

/**
 * Тело POST/PUT /books/:id/entries/:entryId. Разбор исторически снисходителен: поле не того типа
 * падает на дефолт, длинные строки обрезаются, keywordDepth клампится. 400 — только на правилах
 * смысла записи; их порядок (имя → обе ссылки → пустая запись → keyword без слов) — порядок полей.
 */
export class EntryInputDto implements EntryInput {
  /** Имя оборачивает текст записи в промпте как <имя>…</имя> — обязательно. */
  @TrimmedField()
  @IsNotEmpty({ message: "Name is required" })
  name!: string;

  @Transform(({ value }: { value: unknown }) => value !== false)
  @IsBoolean()
  enabled = true;

  @Transform(({ value }: { value: unknown }) => (value === "keyword" ? "keyword" : "always_on"))
  @IsIn(ENTRY_ACTIVATIONS)
  activation: EntryActivation = "always_on";

  @ReferenceId()
  @Allow()
  characterId: number | null = null;

  /** Персонаж и персона одновременно — бессмысленно: какая из двух карточек рендерится? */
  @ReferenceId()
  @EntryRule(
    "entryNotBothReferences",
    "Entry cannot reference both a character and a persona",
    (personaId, entry) => entry.characterId === null || personaId === null,
  )
  personaId: number | null = null;

  @TrimmedField()
  @IsString()
  alias = "";

  /** Запись должна нести смысл: либо ссылка на персонажа/персону, либо непустой текст. */
  @Transform(({ value }: { value: unknown }) => (typeof value === "string" ? value : ""))
  @EntryRule(
    "entryHasSubject",
    "Entry needs a character, a persona or content",
    (content, entry) => entry.characterId !== null || entry.personaId !== null || String(content).trim() !== "",
  )
  content = "";

  /** keyword-активация без триггер-слов никогда не сработает — та же гарантия, что на клиенте. */
  @Transform(({ value }: { value: unknown }) =>
    Array.isArray(value)
      ? value
          .filter((k): k is string => typeof k === "string")
          .map((k) => k.trim().slice(0, MAX_ENTRY_FIELD_LENGTH))
          .filter(Boolean)
      : [],
  )
  @EntryRule(
    "entryKeywordsForActivation",
    "Keyword activation requires at least one keyword",
    (keywords, entry) => entry.activation !== "keyword" || (keywords as string[]).length > 0,
  )
  keywords: string[] = [];

  /** Глубина поиска триггеров: число усекается и клампится, нечисло → дефолт. */
  @Transform(({ value }: { value: unknown }) => {
    const raw = typeof value === "number" ? Math.trunc(value) : DEFAULT_KEYWORD_DEPTH;
    return Math.min(Math.max(raw, MIN_KEYWORD_DEPTH), MAX_KEYWORD_DEPTH);
  })
  @IsInt()
  keywordDepth = DEFAULT_KEYWORD_DEPTH;
}
