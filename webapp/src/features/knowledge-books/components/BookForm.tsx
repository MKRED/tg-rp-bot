import { Button, Text, TextInput } from "@mantine/core";
import { useEffect, useState } from "react";
import { SettingsCard } from "../../../shared/components/SettingsCard";
import { useUnsavedChangesGuard } from "../../../shared/telegram/useUnsavedChangesGuard";
import type { Book, BookInput } from "../types/book";
import { MAX_BOOK_DESCRIPTION_LENGTH, MAX_BOOK_NAME_LENGTH } from "../types/book";

interface BookFormProps {
  initial?: Book;
  submitting: boolean;
  /** Промис — чтобы после успеха сбросить «грязный» снапшот: экран книги после сохранения не закрывается. */
  onSubmit: (input: BookInput) => Promise<void>;
  /** Есть ли несохранённые правки — экран спрашивает подтверждение перед переходом к записи. */
  onDirtyChange: (dirty: boolean) => void;
}

/** Значения формы, как их отправим на сервер (обрезанные, пустое описание → null). */
function normalize(name: string, description: string): BookInput {
  return { name: name.trim(), description: description.trim() || null };
}

/**
 * Карточка «Основное» книги знаний: название, описание и своя кнопка сохранения. Кнопка — в карточке,
 * а не внизу экрана: она сохраняет только эти поля, записи книги сохраняются каждая на своём экране.
 */
export function BookForm({ initial, submitting, onSubmit, onDirtyChange }: BookFormProps) {
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  // Последние сохранённые значения — база для «есть несохранённые изменения».
  const [baseline, setBaseline] = useState(() => normalize(initial?.name ?? "", initial?.description ?? ""));

  const draft = normalize(name, description);
  const dirty = draft.name !== baseline.name || draft.description !== baseline.description;
  useUnsavedChangesGuard(dirty);
  useEffect(() => {
    onDirtyChange(dirty);
  }, [dirty, onDirtyChange]);

  const valid = draft.name.length > 0;

  const handleSubmit = async () => {
    if (!valid || submitting) return;
    try {
      await onSubmit(draft);
      setBaseline(draft);
    } catch (err) {
      // Тост показывает экран; baseline не сбрасываем — правки остаются «несохранёнными».
      console.warn("Не удалось сохранить книгу знаний", err);
    }
  };

  return (
    <SettingsCard
      title="Основное"
      description={initial ? undefined : "Записи — персонажей и факты мира — можно добавить после создания книги."}
    >
      <TextInput
        label="Название"
        placeholder="Напр. «Мир Эльдории»"
        withAsterisk
        maxLength={MAX_BOOK_NAME_LENGTH}
        value={name}
        onChange={(e) => setName(e.currentTarget.value)}
      />
      <TextInput
        label="Описание"
        description="Заметка для себя — в промпт не попадает"
        maxLength={MAX_BOOK_DESCRIPTION_LENGTH}
        value={description}
        onChange={(e) => setDescription(e.currentTarget.value)}
      />
      {initial && dirty && !submitting && (
        <Text size="sm" c="dimmed" ta="center">
          Есть несохранённые изменения
        </Text>
      )}
      <Button fullWidth disabled={!valid} loading={submitting} onClick={handleSubmit}>
        {initial ? "Сохранить" : "Создать книгу"}
      </Button>
    </SettingsCard>
  );
}
