import { Button } from "@mantine/core";
import { FileText } from "lucide-react";
import { useParams } from "react-router-dom";
import { bookEditPath } from "../../app/routes";
import { useTransitionNavigate } from "../../app/useTransitionNavigate";
import { EntryEditor, MAX_ENTRIES_PER_BOOK, useBookEditor } from "../../features/knowledge-books";
import { AppPage } from "../../shared/components/AppPage";
import { EmptyState } from "../../shared/components/EmptyState";

/**
 * Экран записи книги знаний: /books/:id/entries/new и /books/:id/entries/:entryId. Отдельного GET
 * записи нет — берём её из списка записей книги (он же даёт название книги для подзаголовка).
 */
export function EntryEditPage() {
  const navigate = useTransitionNavigate();
  const params = useParams();
  const bookId = Number(params.id);
  const entryId = params.entryId ? Number(params.entryId) : undefined;

  const { book, entries, loading, error } = useBookEditor(bookId);
  const entry = entryId === undefined ? undefined : entries.find((e) => e.id === entryId);
  // replace: запись заменяется книгой в истории — в ней не копится «книга → запись → книга».
  const backToBook = () => navigate(bookEditPath(bookId), { replace: true });

  const notFound = error || (!loading && (!book || (entryId !== undefined && !entry)));
  // Прямая ссылка на «новую запись» обходит выключенную кнопку «Добавить» на экране книги.
  const atLimit = !loading && entryId === undefined && entries.length >= MAX_ENTRIES_PER_BOOK;

  if (notFound || atLimit) {
    return (
      <AppPage centered>
        <EmptyState
          icon={FileText}
          title={notFound ? "Запись не найдена" : "В книге уже максимум записей"}
          description={notFound ? "Возможно, её удалили." : `Лимит — ${MAX_ENTRIES_PER_BOOK} записей на книгу.`}
          action={
            <Button variant="default" onClick={backToBook}>
              К книге
            </Button>
          }
        />
      </AppPage>
    );
  }

  return (
    <AppPage title={entryId === undefined ? "Новая запись" : "Запись"} description={book?.name} loading={loading}>
      <EntryEditor bookId={bookId} initial={entry} onDone={backToBook} />
    </AppPage>
  );
}
