import { Button } from "@mantine/core";
import { BookOpen } from "lucide-react";
import { useState } from "react";
import { useParams } from "react-router-dom";
import { ROUTES, bookEditPath, bookEntryEditPath, bookEntryNewPath } from "../../app/routes";
import { useTransitionNavigate } from "../../app/useTransitionNavigate";
import {
  BookEntries,
  BookForm,
  createBook,
  removeBook,
  updateBook,
  useBookEditor,
  type BookInput,
} from "../../features/knowledge-books";
import { ApiError } from "../../shared/api/client";
import { AppPage } from "../../shared/components/AppPage";
import { DeleteButton } from "../../shared/components/DeleteButton";
import { EmptyState } from "../../shared/components/EmptyState";
import { confirmAction, showAlert } from "../../shared/telegram/confirm";
import { useToast } from "../../shared/toast";

/**
 * Экран книги знаний: название и описание, записи (у сохранённой книги) и удаление. Каждая запись
 * правится на своём экране; сохранение книги не уводит с экрана — записи остаются под рукой.
 */
export function BookEditPage() {
  const navigate = useTransitionNavigate();
  const params = useParams();
  const { showToast } = useToast();
  const id = params.id ? Number(params.id) : undefined;

  const { book, entries, loading, error, reorder } = useBookEditor(id);
  const [submitting, setSubmitting] = useState(false);
  const [bookDirty, setBookDirty] = useState(false);

  const handleSubmitBook = (input: BookInput): Promise<void> => {
    setSubmitting(true);
    if (id === undefined) {
      return (
        createBook(input)
          // Сразу на экран созданной книги — добавлять записи. replace: «Назад» оттуда ведёт к списку,
          // а не на пустую форму создания.
          .then((res) => navigate(bookEditPath(res.book.id), { replace: true }))
          .catch((err) => {
            setSubmitting(false);
            showToast({ type: "error", message: "Не удалось создать книгу" });
            throw err;
          })
      );
    }
    return updateBook(id, input)
      .then(() => {
        showToast({ type: "success", message: "Книга сохранена" });
      })
      .catch((err) => {
        showToast({ type: "error", message: "Не удалось сохранить книгу" });
        throw err;
      })
      .finally(() => setSubmitting(false));
  };

  const handleDeleteBook = async () => {
    if (id === undefined) return;
    const confirmed = await confirmAction("Удалить книгу знаний вместе с записями? Это действие необратимо.", {
      title: "Удаление книги знаний",
    });
    if (!confirmed) return;
    setSubmitting(true);
    removeBook(id)
      .then(() => navigate(ROUTES.books))
      .catch(async (err) => {
        setSubmitting(false);
        // 409 — FK нарушение: книга выбрана в истории.
        if (err instanceof ApiError && err.status === 409) {
          await showAlert("Книга используется в истории. Сначала удалите историю.", "Нельзя удалить");
        } else {
          showToast({ type: "error", message: "Не удалось удалить книгу" });
        }
      });
  };

  // Переход к записи размонтирует форму книги — несохранённые название/описание пропали бы молча.
  const openEntry = async (path: string) => {
    if (bookDirty) {
      const leave = await confirmAction("Изменения названия и описания книги не сохранены и будут потеряны.", {
        title: "Перейти без сохранения?",
        confirmText: "Перейти",
      });
      if (!leave) return;
    }
    navigate(path);
  };

  // Сдвиг записи на одну позицию (↑/↓): порядок влияет на очередь вставки в промпт истории.
  const moveEntry = (index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= entries.length) return;
    const ids = entries.map((en) => en.id);
    [ids[index], ids[target]] = [ids[target]!, ids[index]!];
    reorder(ids);
  };

  if (error || (!loading && id !== undefined && !book)) {
    return (
      <AppPage centered>
        <EmptyState
          icon={BookOpen}
          title="Книга не найдена"
          description="Возможно, её удалили."
          action={
            <Button variant="default" onClick={() => navigate(ROUTES.books)}>
              К списку книг
            </Button>
          }
        />
      </AppPage>
    );
  }

  return (
    <AppPage title={id === undefined ? "Новая книга" : "Книга знаний"} loading={loading}>
      <BookForm initial={book} submitting={submitting} onSubmit={handleSubmitBook} onDirtyChange={setBookDirty} />
      {id !== undefined && (
        <>
          <BookEntries
            entries={entries}
            onOpen={(e) => openEntry(bookEntryEditPath(id, e.id))}
            onAdd={() => openEntry(bookEntryNewPath(id))}
            onMove={moveEntry}
          />
          <DeleteButton disabled={submitting} onClick={handleDeleteBook}>
            Удалить книгу
          </DeleteButton>
        </>
      )}
    </AppPage>
  );
}
