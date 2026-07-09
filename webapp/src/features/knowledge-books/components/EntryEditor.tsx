import { Button, Cell, List, Modal, Section, Switch } from "@telegram-apps/telegram-ui";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronRight } from "lucide-react";
import { useState } from "react";
import { HintedInput } from "../../../shared/components/HintedInput";
import { PromptField } from "../../../shared/components/PromptField";
import { SectionActions } from "../../../shared/components/SectionActions";
import { CharacterAvatar, useCharacter, useCharacters } from "../../characters";
import { createEntry, removeEntry, updateEntry } from "../api/books-api";
import type { Entry } from "../types/book";

interface EntryEditorProps {
  bookId: number;
  /** undefined → создание новой записи. */
  initial?: Entry;
  onSaved: () => void;
  onCancel: () => void;
}

type Mode = "character" | "free";

const USER_PLACEHOLDER_RE = /\{\{user\}\}/i;

/**
 * Редактор одной записи книги знаний. Два вида: «персонаж» (ссылка на карточку) или «свободный текст».
 * Активация always_on активна; «по ключу» (keyword) — задел, пока выключена. keywords в UI не вводим
 * (нужны только keyword-режиму). name обязателен — в промпте им оборачивается текст записи:
 * <name>…</name> (getActiveEntriesForPrompt).
 */
export function EntryEditor({ bookId, initial, onSaved, onCancel }: EntryEditorProps) {
  const { items: characters } = useCharacters();

  const [name, setName] = useState(initial?.name ?? "");
  const [mode, setMode] = useState<Mode>(initial?.characterId != null ? "character" : "free");
  const [characterId, setCharacterId] = useState<number | null>(initial?.characterId ?? null);
  const [content, setContent] = useState(initial?.content ?? "");
  const [userAlias, setUserAlias] = useState(initial?.userAlias ?? "");
  const [enabled, setEnabled] = useState(initial?.enabled ?? true);
  const [submitting, setSubmitting] = useState(false);
  const [charOpen, setCharOpen] = useState(false);

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

  // Полная карточка (с промптом) нужна только чтобы проверить {{user}} — список её не отдаёт.
  // Сценарий карточки в промпт книги знаний не идёт, поэтому его на {{user}} не проверяем.
  const { character: selectedCharacterFull, loading: characterLoading } = useCharacter(
    mode === "character" && characterId != null ? characterId : undefined,
  );
  const needsUserAlias =
    selectedCharacterFull != null && USER_PLACEHOLDER_RE.test(selectedCharacterFull.prompt);

  // Пока полная карточка грузится, для уже сохранённой записи предсказываем нужность инпута по
  // непустому initial.userAlias (при сохранении он непуст ⇔ промпт содержал {{user}}). Иначе инпут
  // «доскакивал» бы после загрузки карточки и дёргал layout при открытии редактирования. Как только
  // карточка подгрузилась — источник истины только needsUserAlias (валидатор ниже на нём же).
  const predictUserAlias =
    characterLoading &&
    characterId === initial?.characterId &&
    (initial?.userAlias?.trim().length ?? 0) > 0;
  const showUserAlias = needsUserAlias || predictUserAlias;

  const valid =
    name.trim().length > 0 &&
    (mode === "character"
      ? characterId != null && !characterLoading && (!needsUserAlias || userAlias.trim().length > 0)
      : content.trim().length > 0);

  const handleSave = () => {
    if (!valid || submitting) return;
    setSubmitting(true);
    const input = {
      name: name.trim(),
      enabled,
      activation: "always_on" as const,
      characterId: mode === "character" ? characterId : null,
      userAlias: mode === "character" ? userAlias.trim() : "",
      content: mode === "free" ? content : "",
      keywords: [],
    };
    const op = initial
      ? updateEntry(bookId, initial.id, input)
      : createEntry(bookId, input);
    op.then(onSaved).catch(() => setSubmitting(false));
  };

  const handleDelete = () => {
    if (!initial || submitting) return;
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
          mode={mode === "free" ? "filled" : "outline"}
          stretched
          onClick={() => setMode("free")}
        >
          Свободный текст
        </Button>
      </div>

      {mode === "character" ? (
        <Cell
          before={
            selectedDisplay ? (
              <CharacterAvatar
                id={selectedDisplay.id}
                hasImage={selectedDisplay.hasImage}
                name={selectedDisplay.name}
                size={40}
              />
            ) : undefined
          }
          after={<ChevronRight size={20} style={{ opacity: 0.4 }} />}
          subtitle={selectedDisplay ? "Персонаж" : "Обязательно"}
          onClick={() => setCharOpen(true)}
        >
          {selectedDisplay?.name ?? "Выберите персонажа"}
        </Cell>
      ) : null}

      {/* Инпут появляется/схлопывается плавно: needsUserAlias зависит от асинхронно подгружаемой
          карточки, без анимации он бы резко «доскакивал» при смене персонажа/новой записи. */}
      <AnimatePresence>
        {mode === "character" && showUserAlias ? (
          <motion.div
            key="user-alias"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            style={{ overflow: "hidden" }}
          >
            <HintedInput
              header="Обращение к пользователю"
              placeholder="Напр. «Михаил» или «Странник»"
              hint="Промпт этого персонажа содержит {{user}} — narrator не отыгрывает персону, укажите текст для подстановки."
              value={userAlias}
              onChange={(e) => setUserAlias(e.target.value)}
            />
          </motion.div>
        ) : null}
      </AnimatePresence>

      {mode === "free" ? (
        <PromptField
          label="Текст записи"
          hint="Факт о мире / предмете / месте. Записи always_on уходят в промпт модели при каждом бите истории."
          placeholder="Факт о мире / предмете / месте…"
          rows={6}
          value={content}
          onChange={setContent}
        />
      ) : null}

      <div style={{ padding: "8px 22px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span>Включена</span>
        <Switch checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
      </div>

      <SectionActions>
        <Button size="l" stretched disabled={!valid || submitting} onClick={handleSave}>
          {initial ? "Сохранить" : "Добавить"}
        </Button>
        <Button size="m" mode="plain" stretched onClick={onCancel} disabled={submitting}>
          Отмена
        </Button>
        {initial && (
          <Button size="l" mode="outline" stretched onClick={handleDelete} disabled={submitting}>
            Удалить запись
          </Button>
        )}
      </SectionActions>

      {/* Модал выбора персонажа — вместо нативного select */}
      <Modal
        open={charOpen}
        onOpenChange={setCharOpen}
        header={<Modal.Header>Персонаж</Modal.Header>}
      >
        <List>
          {characters.map((c) => (
            <Cell
              key={c.id}
              before={<CharacterAvatar id={c.id} hasImage={c.hasImage} name={c.name} size={40} />}
              onClick={() => {
                setCharacterId(c.id);
                setCharOpen(false);
              }}
            >
              {c.name}
            </Cell>
          ))}
        </List>
      </Modal>
    </Section>
  );
}
