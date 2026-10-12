import { useCharacter, useCharacters } from "../../../characters";
import { usePersona, usePersonas } from "../../../personas";
import { selectedOf } from "../../lib/entryReference";
import type { Entry } from "../../types/book";

export type EntryMode = "character" | "persona" | "free";

const USER_PLACEHOLDER_RE = /\{\{user\}\}/i;
const CHAR_PLACEHOLDER_RE = /\{\{char\}\}/i;

/**
 * Ссылочная часть записи: списки для выбора, выбранный персонаж/персона и нужен ли псевдоним.
 *
 * Псевдоним нужен, если промпт выбранного персонажа содержит {{user}} (narrator не отыгрывает
 * персону — подставить нечего), а у персоны — {{char}} (narrator не привязан к персонажу). Для этого
 * грузится полная карточка: список промпт не отдаёт. Сценарий персонажа в промпт книги не идёт —
 * его на {{user}} не проверяем.
 */
export function useEntryReference(
  mode: EntryMode,
  characterId: number | null,
  personaId: number | null,
  initial: Entry | undefined,
) {
  const { items: characters } = useCharacters();
  const { items: personas } = usePersonas();

  const selectedCharacter = selectedOf(characters, characterId, {
    id: initial?.characterId,
    name: initial?.characterName,
    hasImage: initial?.characterHasImage,
  });
  const selectedPersona = selectedOf(personas, personaId, {
    id: initial?.personaId,
    name: initial?.personaName,
    hasImage: initial?.personaHasImage,
  });

  const { character, loading: characterLoading } = useCharacter(
    mode === "character" && characterId != null ? characterId : undefined,
  );
  const { persona, loading: personaLoading } = usePersona(
    mode === "persona" && personaId != null ? personaId : undefined,
  );
  // Хуки не сбрасывают прошлую карточку при смене id или ошибке загрузки — берём только карточку
  // именно выбранной ссылки, иначе «нужен ли псевдоним» остался бы от предыдущего выбора.
  const fullCharacter = character?.id === characterId ? character : undefined;
  const fullPersona = persona?.id === personaId ? persona : undefined;
  const needsUserAlias = fullCharacter != null && USER_PLACEHOLDER_RE.test(fullCharacter.prompt);
  const needsCharAlias = fullPersona != null && CHAR_PLACEHOLDER_RE.test(fullPersona.prompt);

  // Пока полная карточка грузится, для сохранённой записи предсказываем поле псевдонима по непустому
  // initial.alias (при сохранении он непуст ⇔ промпт содержал плейсхолдер) — иначе поле «доскакивало»
  // бы после загрузки. После загрузки источник истины — needs*Alias (по ним же проверка формы).
  const savedAlias = (initial?.alias?.trim().length ?? 0) > 0;
  const showAlias =
    mode === "character"
      ? needsUserAlias || (characterLoading && characterId === initial?.characterId && savedAlias)
      : mode === "persona"
        ? needsCharAlias || (personaLoading && personaId === initial?.personaId && savedAlias)
        : false;

  // Ссылка выбрана и проверена: загружена карточка именно её — известно, нужен ли псевдоним. Если
  // загрузка упала, сохранить нельзя: без промпта не проверить {{user}}/{{char}}.
  const referenceReady =
    mode === "character"
      ? fullCharacter != null && !characterLoading
      : mode === "persona"
        ? fullPersona != null && !personaLoading
        : true;
  const aliasRequired = mode === "character" ? needsUserAlias : mode === "persona" ? needsCharAlias : false;

  return { characters, personas, selectedCharacter, selectedPersona, showAlias, aliasRequired, referenceReady };
}
