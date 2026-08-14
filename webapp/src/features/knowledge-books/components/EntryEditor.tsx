import { Button, Section, Slider, Switch, Text } from "@telegram-apps/telegram-ui";
import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import { DeleteButton } from "../../../shared/components/DeleteButton";
import { FieldHint } from "../../../shared/components/FieldHint";
import { HintedInput } from "../../../shared/components/HintedInput";
import { PromptEditorField } from "../../../shared/components/PromptEditorField";
import { SectionActions } from "../../../shared/components/SectionActions";
import { CharacterAvatar, useCharacter, useCharacters } from "../../characters";
import { PersonaAvatar, usePersona, usePersonas } from "../../personas";
import { confirmAction } from "../../../shared/telegram/confirm";
import { createEntry, removeEntry, updateEntry } from "../api/books-api";
import type { Entry, EntryActivation } from "../types/book";
import { DEFAULT_KEYWORD_DEPTH, MAX_KEYWORD_DEPTH, MIN_KEYWORD_DEPTH } from "../types/book";
import { EntryReferencePicker } from "./EntryReferencePicker";
import { KeywordsInput } from "./KeywordsInput";

interface EntryEditorProps {
  bookId: number;
  /** undefined → создание новой записи. */
  initial?: Entry;
  onSaved: () => void;
  onCancel: () => void;
}

type Mode = "character" | "persona" | "free";

const USER_PLACEHOLDER_RE = /\{\{user\}\}/i;
const CHAR_PLACEHOLDER_RE = /\{\{char\}\}/i;

/**
 * Редактор одной записи книги знаний. Три вида: «персонаж»/«персона» (ссылка на карточку) или
 * «свободный текст». Активация: always_on (всегда в промпте) или keyword (дополнительно к enabled —
 * только если одно из триггер-слов встретилось среди последних keywordDepth сообщений истории).
 * name обязателен — в промпте им оборачивается текст записи: <name>…</name> (getActiveEntriesForPrompt).
 */
export function EntryEditor({ bookId, initial, onSaved, onCancel }: EntryEditorProps) {
  const { items: characters } = useCharacters();
  const { items: personas } = usePersonas();

  const [name, setName] = useState(initial?.name ?? "");
  const [mode, setMode] = useState<Mode>(
    initial?.characterId != null ? "character" : initial?.personaId != null ? "persona" : "free",
  );
  const [characterId, setCharacterId] = useState<number | null>(initial?.characterId ?? null);
  const [personaId, setPersonaId] = useState<number | null>(initial?.personaId ?? null);
  const [content, setContent] = useState(initial?.content ?? "");
  const [alias, setAlias] = useState(initial?.alias ?? "");
  const [activation, setActivation] = useState<EntryActivation>(initial?.activation ?? "always_on");
  const [keywords, setKeywords] = useState<string[]>(initial?.keywords ?? []);
  const [keywordDepth, setKeywordDepth] = useState(initial?.keywordDepth ?? DEFAULT_KEYWORD_DEPTH);
  const [enabled, setEnabled] = useState(initial?.enabled ?? true);
  const [submitting, setSubmitting] = useState(false);
  const [charOpen, setCharOpen] = useState(false);
  const [personaOpen, setPersonaOpen] = useState(false);

  const selectedCharacter = characters.find((c) => c.id === characterId) ?? null;
  // Пока список персонажей (useCharacters) грузится, для уже сохранённой записи берём имя/аватар из
  // initial (сервер отдаёт их резолвом) — иначе Cell на миг мигает «Выберите персонажа». Как только
  // список пришёл, он источник истины (свежее имя при переименовании). Выбор через модал берётся из
  // уже загруженного списка, поэтому гейт по characterId === initial.characterId.
  const selectedDisplay =
    selectedCharacter ??
    (characterId != null && characterId === initial?.characterId && initial?.characterName != null
      ? { id: characterId, name: initial.characterName, hasImage: initial.characterHasImage }
      : null);

  // Симметрично персонажу: пока список персон грузится, для сохранённой записи берём имя/аватар из initial.
  const selectedPersona = personas.find((p) => p.id === personaId) ?? null;
  const selectedPersonaDisplay =
    selectedPersona ??
    (personaId != null && personaId === initial?.personaId && initial?.personaName != null
      ? { id: personaId, name: initial.personaName, hasImage: initial.personaHasImage }
      : null);

  // Полная карточка (с промптом) нужна только чтобы проверить {{user}} — список её не отдаёт.
  // Сценарий карточки в промпт книги знаний не идёт, поэтому его на {{user}} не проверяем.
  const { character: selectedCharacterFull, loading: characterLoading } = useCharacter(
    mode === "character" && characterId != null ? characterId : undefined,
  );
  const needsUserAlias =
    selectedCharacterFull != null && USER_PLACEHOLDER_RE.test(selectedCharacterFull.prompt);

  // Симметрично: полная персона нужна только чтобы проверить {{char}} в её промпте.
  const { persona: selectedPersonaFull, loading: personaLoading } = usePersona(
    mode === "persona" && personaId != null ? personaId : undefined,
  );
  const needsCharAlias =
    selectedPersonaFull != null && CHAR_PLACEHOLDER_RE.test(selectedPersonaFull.prompt);

  // Пока полная карточка/персона грузится, для уже сохранённой записи предсказываем нужность инпута
  // по непустому initial.alias (при сохранении он непуст ⇔ промпт содержал плейсхолдер). Иначе инпут
  // «доскакивал» бы после загрузки и дёргал layout при открытии редактирования. Как только карточка/
  // персона подгрузилась — источник истины только needsUserAlias/needsCharAlias (валидатор ниже на них же).
  const predictUserAlias =
    characterLoading &&
    characterId === initial?.characterId &&
    (initial?.alias?.trim().length ?? 0) > 0;
  const predictCharAlias =
    personaLoading && personaId === initial?.personaId && (initial?.alias?.trim().length ?? 0) > 0;
  const showAlias =
    mode === "character"
      ? needsUserAlias || predictUserAlias
      : mode === "persona"
        ? needsCharAlias || predictCharAlias
        : false;

  const valid =
    name.trim().length > 0 &&
    (mode === "character"
      ? characterId != null && !characterLoading && (!needsUserAlias || alias.trim().length > 0)
      : mode === "persona"
        ? personaId != null && !personaLoading && (!needsCharAlias || alias.trim().length > 0)
        : content.trim().length > 0) &&
    // Запись «по ключу» без триггер-слов никогда не сработает — требуем хотя бы одно.
    (activation !== "keyword" || keywords.length > 0);

  const handleSave = () => {
    if (!valid || submitting) return;
    setSubmitting(true);
    const input = {
      name: name.trim(),
      enabled,
      activation,
      characterId: mode === "character" ? characterId : null,
      personaId: mode === "persona" ? personaId : null,
      alias: mode === "character" || mode === "persona" ? alias.trim() : "",
      content: mode === "free" ? content.trim() : "",
      keywords: activation === "keyword" ? keywords.map((k) => k.trim()).filter(Boolean) : [],
      keywordDepth,
    };
    const op = initial
      ? updateEntry(bookId, initial.id, input)
      : createEntry(bookId, input);
    op.then(onSaved).catch(() => setSubmitting(false));
  };

  const handleDelete = async () => {
    if (!initial || submitting) return;
    const confirmed = await confirmAction("Удалить запись? Это действие необратимо.", {
      title: "Удаление записи",
    });
    if (!confirmed) return;
    setSubmitting(true);
    removeEntry(bookId, initial.id).then(onSaved).catch(() => setSubmitting(false));
  };

  return (
    <Section className="section-blend-inputs" header={initial ? "Редактирование записи" : "Новая запись"}>
      <HintedInput
        header="Название"
        placeholder="Напр. «Анна» или «Таверна»"
        hint="Обязательно — этим названием текст записи оборачивается в промпте модели."
        value={name}
        onChange={(e) => setName(e.target.value)}
      />

      <div style={{ display: "flex", gap: 8, padding: "8px 22px" }}>
        <Button
          size="s"
          mode={mode === "character" ? "filled" : "outline"}
          stretched
          onClick={() => setMode("character")}
        >
          Персонаж
        </Button>
        <Button
          size="s"
          mode={mode === "persona" ? "filled" : "outline"}
          stretched
          onClick={() => setMode("persona")}
        >
          Персона
        </Button>
        <Button
          size="s"
          mode={mode === "free" ? "filled" : "outline"}
          stretched
          onClick={() => setMode("free")}
        >
          Свободный текст
        </Button>
      </div>

      {mode === "character" ? (
        <EntryReferencePicker
          items={characters}
          selected={selectedDisplay}
          Avatar={CharacterAvatar}
          modalTitle="Персонаж"
          typeLabel="Персонаж"
          emptyLabel="Выберите персонажа"
          open={charOpen}
          onOpenChange={setCharOpen}
          onSelect={setCharacterId}
        />
      ) : null}

      {mode === "persona" ? (
        <EntryReferencePicker
          items={personas}
          selected={selectedPersonaDisplay}
          Avatar={PersonaAvatar}
          modalTitle="Персона"
          typeLabel="Персона"
          emptyLabel="Выберите персону"
          open={personaOpen}
          onOpenChange={setPersonaOpen}
          onSelect={setPersonaId}
        />
      ) : null}

      {/* Инпут появляется/схлопывается плавно: needsUserAlias/needsCharAlias зависят от асинхронно
          подгружаемой карточки/персоны, без анимации он бы резко «доскакивал» при смене выбора. */}
      <AnimatePresence>
        {showAlias ? (
          <motion.div
            key="alias"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            style={{ overflow: "hidden" }}
          >
            <HintedInput
              header={mode === "character" ? "Обращение к пользователю" : "Имя персонажа"}
              placeholder={mode === "character" ? "Напр. «Михаил» или «Странник»" : "Напр. «Артур»"}
              hint={
                mode === "character"
                  ? "Промпт этого персонажа содержит {{user}} — narrator не отыгрывает персону, укажите текст для подстановки."
                  : "Промпт этой персоны содержит {{char}} — narrator не привязан к конкретному персонажу, укажите текст для подстановки."
              }
              value={alias}
              onChange={(e) => setAlias(e.target.value)}
            />
          </motion.div>
        ) : null}
      </AnimatePresence>

      {mode === "free" ? (
        <PromptEditorField
          header="Текст записи"
          hint="Факт о мире / предмете / месте. Записи always_on уходят в промпт модели при каждом бите истории."
          placeholder="Факт о мире / предмете / месте…"
          previewLines={6}
          value={content}
          onChange={setContent}
        />
      ) : null}

      <div style={{ padding: "8px 22px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Text>Включена</Text>
        <Switch checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
      </div>

      <div style={{ display: "flex", gap: 8, padding: "8px 22px" }}>
        <Button
          size="s"
          mode={activation === "always_on" ? "filled" : "outline"}
          stretched
          onClick={() => setActivation("always_on")}
        >
          Всегда
        </Button>
        <Button
          size="s"
          mode={activation === "keyword" ? "filled" : "outline"}
          stretched
          onClick={() => setActivation("keyword")}
        >
          По ключевым словам
        </Button>
      </div>

      <AnimatePresence>
        {activation === "keyword" ? (
          <motion.div
            key="keyword"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            style={{ overflow: "hidden" }}
          >
            <KeywordsInput keywords={keywords} onChange={setKeywords} />
            <div style={{ padding: "8px 22px 0" }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 500 }}>
                <Text>Искать в последних сообщениях</Text>
                <Text style={{ color: "var(--tgui--hint_color)" }}>{keywordDepth}</Text>
              </div>
              <Slider
                min={MIN_KEYWORD_DEPTH}
                max={MAX_KEYWORD_DEPTH}
                step={1}
                value={keywordDepth}
                onChange={setKeywordDepth}
              />
              <FieldHint>Сколько последних сообщений (пользователь + модель) сканировать на триггер-слова.</FieldHint>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <SectionActions>
        <Button size="l" stretched disabled={!valid || submitting} onClick={handleSave}>
          {initial ? "Сохранить" : "Добавить"}
        </Button>
        <Button size="m" mode="plain" stretched onClick={onCancel} disabled={submitting}>
          Отмена
        </Button>
        {initial && (
          <DeleteButton onClick={handleDelete} disabled={submitting}>
            Удалить запись
          </DeleteButton>
        )}
      </SectionActions>
    </Section>
  );
}
