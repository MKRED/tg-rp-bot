import { BookOpen } from "lucide-react";
import { ROUTES, bookEditPath } from "../../app/routes";
import { useTransitionNavigate } from "../../app/useTransitionNavigate";
import { MAX_BOOKS_PER_USER, useBooks } from "../../features/knowledge-books";
import { ListRow } from "../../shared/components/ListCard";
import { ListPage } from "../../shared/components/ListPage";
import { pluralRu } from "../../shared/text/pluralRu";

/** Хаб «Книги знаний»: все книги пользователя и создание новой. */
export function BooksListPage() {
  const navigate = useTransitionNavigate();
  const { items, loading, error } = useBooks();

  return (
    <ListPage
      title="Книги знаний"
      description="Персонажи и факты мира для режима «Режиссёр истории»"
      icon={BookOpen}
      loading={loading}
      error={error}
      count={items.length}
      limit={MAX_BOOKS_PER_USER}
      limitText={`Достигнут лимит в ${MAX_BOOKS_PER_USER} книг`}
      createLabel="Создать книгу"
      emptyTitle="Пока нет книг"
      emptyDescription="Книга знаний — набор записей о персонажах, местах и фактах мира, которые рассказчик держит в памяти."
      onCreate={() => navigate(ROUTES.bookNew)}
    >
      {items.map((b, i) => (
        <ListRow
          key={b.id}
          index={i}
          title={b.name}
          // Описание книги, если задано; иначе — сколько в ней записей.
          description={b.description || `${b.entryCount} ${pluralRu(b.entryCount, ["запись", "записи", "записей"])}`}
          onClick={() => navigate(bookEditPath(b.id))}
        />
      ))}
    </ListPage>
  );
}
