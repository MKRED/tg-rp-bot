import { Button, Input, Section, Textarea } from "@telegram-apps/telegram-ui";
import { useState } from "react";
import type { Book, BookInput } from "../types/book";

interface BookFormProps {
  initial?: Book;
  submitting: boolean;
  onSubmit: (input: BookInput) => void;
  onDelete?: () => void;
}

/** Форма создания/редактирования книги знаний: имя + описание. */
export function BookForm({ initial, submitting, onSubmit, onDelete }: BookFormProps) {
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");

  const valid = name.trim().length > 0;

  return (
    <Section className="section-blend-inputs" header="Книга знаний">
      <Input
        header="Название"
        placeholder="Напр. «Мир Эльдории»"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <Textarea
        header="Описание (необязательно)"
        placeholder="Краткое описание для себя"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
      />
      <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 24, padding: "0 22px" }}>
        <Button
          size="l"
          stretched
          disabled={!valid || submitting}
          onClick={() => onSubmit({ name: name.trim(), description: description.trim() || null })}
        >
          {initial ? "Сохранить" : "Создать книгу"}
        </Button>
        {onDelete && (
          <Button size="l" mode="outline" stretched onClick={onDelete} disabled={submitting}>
            Удалить книгу
          </Button>
        )}
      </div>
    </Section>
  );
}
