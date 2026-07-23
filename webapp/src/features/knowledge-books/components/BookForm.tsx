import { Button, Input, Section } from "@telegram-apps/telegram-ui";
import { useState } from "react";
import { DeleteButton } from "../../../shared/components/DeleteButton";
import { SectionActions } from "../../../shared/components/SectionActions";
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
      <Input
        header="Описание (необязательно)"
        placeholder="Краткое описание для себя"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
      />
      <SectionActions>
        <Button
          size="l"
          stretched
          disabled={!valid || submitting}
          onClick={() => onSubmit({ name: name.trim(), description: description.trim() || null })}
        >
          {initial ? "Сохранить" : "Создать книгу"}
        </Button>
        {onDelete && (
          <DeleteButton onClick={onDelete} disabled={submitting}>
            Удалить книгу
          </DeleteButton>
        )}
      </SectionActions>
    </Section>
  );
}
