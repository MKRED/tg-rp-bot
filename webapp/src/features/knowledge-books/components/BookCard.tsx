import { Cell } from "@telegram-apps/telegram-ui";
import { BookOpen } from "lucide-react";
import type { BookListItem } from "../types/book";

interface BookCardProps {
  book: BookListItem;
  onClick: () => void;
}

/** Ячейка книги знаний в списках (хаб + «все книги»). Общая, чтобы разметка не расходилась. */
export function BookCard({ book, onClick }: BookCardProps) {
  return (
    <Cell
      before={<BookOpen size={24} />}
      subtitle={book.description ?? `${book.entryCount} записей`}
      onClick={onClick}
    >
      {book.name}
    </Cell>
  );
}
