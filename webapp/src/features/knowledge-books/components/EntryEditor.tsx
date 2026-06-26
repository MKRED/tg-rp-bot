import { Button, Cell, Input, List, Modal, Section, Switch } from "@telegram-apps/telegram-ui";
import { ChevronRight } from "lucide-react";
import { useState } from "react";
import { PromptField } from "../../../shared/components/PromptField";
import { CharacterAvatar, useCharacters } from "../../characters";
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

/**
 * Редактор одной записи книги знаний. Два вида: «персонаж» (ссылка на карточку) или «свободный текст».
 * Активация always_on активна; «по ключу» (keyword) — задел, пока выключена. keywords в UI не вводим
 * (нужны только keyword-режиму). name — метка только для вас (в промпт не уходит).
 */
export function EntryEditor({ bookId, initial, onSaved, onCancel }: EntryEditorProps) {
  const { items: characters } = useCharacters();

  const [name, setName] = useState(initial?.name ?? "");
  const [mode, setMode] = useState<Mode>(initial?.characterId != null ? "character" : "free");
  const [characterId, setCharacterId] = useState<number | null>(initial?.characterId ?? null);
  const [content, setContent] = useState(initial?.content ?? "");
  const [enabled, setEnabled] = useState(initial?.enabled ?? true);
  const [submitting, setSubmitting] = useState(false);
  const [charOpen, setCharOpen] = useState(false);

  const selectedCharacter = characters.find((c) => c.id === characterId) ?? null;

  const valid = mode === "character" ? characterId != null : content.trim().length > 0;

  const handleSave = () => {
    if (!valid || submitting) return;
    setSubmitting(true);
    const input = {
      name: name.trim(),
      enabled,
      activation: "always_on" as const,
      characterId: mode === "character" ? characterId : null,
      content: mode === "free" ? content : "",
      keywords: [],
      sortOrder: initial?.sortOrder ?? 0,
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
    <Section header={initial ? "Редактирование записи" : "Новая запись"}>
      <Input
        header="Название (только для вас)"
        placeholder="Напр. «Анна» или «Таверна»"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />

      <div style={{ display: "flex", gap: 8, padding: "8px 16px" }}>
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
            selectedCharacter ? (
              <CharacterAvatar
                id={selectedCharacter.id}
                hasImage={selectedCharacter.hasImage}
                name={selectedCharacter.name}
                size={40}
              />
            ) : undefined
          }
          after={<ChevronRight size={20} style={{ opacity: 0.4 }} />}
          subtitle={selectedCharacter ? "Персонаж" : "Обязательно"}
          onClick={() => setCharOpen(true)}
        >
          {selectedCharacter?.name ?? "Выберите персонажа"}
        </Cell>
      ) : (
        <PromptField
          label="Текст записи"
          hint="Факт о мире / предмете / месте. Записи always_on уходят в промпт модели при каждом бите истории."
          placeholder="Факт о мире / предмете / месте…"
          rows={6}
          value={content}
          onChange={setContent}
        />
      )}

      <div style={{ padding: "8px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span>Включена</span>
        <Switch checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: "8px 16px" }}>
        <Button size="l" stretched disabled={!valid || submitting} onClick={handleSave}>
          {initial ? "Сохранить" : "Добавить"}
        </Button>
        <Button size="m" mode="plain" stretched onClick={onCancel} disabled={submitting}>
          Отмена
        </Button>
        {initial && (
          <Button size="m" mode="plain" stretched onClick={handleDelete} disabled={submitting}>
            Удалить запись
          </Button>
        )}
      </div>

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
