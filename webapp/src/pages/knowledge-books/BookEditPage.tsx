import { Button, Cell, List, Section, Spinner } from "@telegram-apps/telegram-ui";
import { Plus, User, FileText } from "lucide-react";
import { useState } from "react";
import { useParams } from "react-router-dom";
import { ROUTES, bookEditPath } from "../../app/routes";
import { useTransitionNavigate } from "../../app/useTransitionNavigate";
import { PageTransition } from "../../shared/components/PageTransition";
import {
  BookForm,
  EntryEditor,
  MAX_ENTRIES_PER_BOOK,
  createBook,
  removeBook,
  updateBook,
  useBookEditor,
  type BookInput,
  type Entry,
} from "../../features/knowledge-books";
import { ApiError } from "../../shared/api/client";
import { confirmAction, showAlert } from "../../shared/telegram/confirm";
import "./knowledge-books.css";

/** «new» при создании, объект Entry при правке записи, null — список без редактора. */
type EntryEdit = "new" | Entry | null;

/** Экран создания/редактирования книги знаний: форма книги + список записей с редактором. */
export function BookEditPage() {
  const navigate = useTransitionNavigate();
  const params = useParams();
  const id = params.id ? Number(params.id) : undefined;

  const { book, entries, loading, error, reloadEntries } = useBookEditor(id);
  const [submitting, setSubmitting] = useState(false);
  const [entryEdit, setEntryEdit] = useState<EntryEdit>(null);

  const handleSubmitBook = (input: BookInput) => {
    setSubmitting(true);
    if (id === undefined) {
      createBook(input)
        // После создания переходим на экран правки той же книги — чтобы сразу добавить записи.
        .then((res) => navigate(bookEditPath(res.book.id)))
        .catch(() => setSubmitting(false));
    } else {
      updateBook(id, input)
        .then(() => navigate(ROUTES.books))
        .catch(() => setSubmitting(false));
    }
  };

  const handleDeleteBook = async () => {
    if (id === undefined) return;
    const confirmed = await confirmAction("Удалить книгу знаний? Это действие необратимо.");
    if (!confirmed) return;
    setSubmitting(true);
    removeBook(id)
      .then(() => navigate(ROUTES.books))
      .catch(async (err) => {
        setSubmitting(false);
        if (err instanceof ApiError && err.status === 409) {
          await showAlert("Книга используется в истории. Сначала удалите историю.", "Нельзя удалить");
        }
      });
  };

  if (loading) {
    return (
      <PageTransition>
        <div className="kb-page__fullcenter">
          <Spinner size="m" />
        </div>
      </PageTransition>
    );
  }
  if (error || (id !== undefined && !book)) {
    return (
      <PageTransition>
        <div className="kb-page__fullcenter">Книга не найдена</div>
      </PageTransition>
    );
  }

  const atLimit = entries.length >= MAX_ENTRIES_PER_BOOK;

  return (
    <PageTransition>
      <div className="kb-page">
        <List>
          <BookForm
            initial={book}
            submitting={submitting}
            onSubmit={handleSubmitBook}
            onDelete={id === undefined ? undefined : handleDeleteBook}
          />

          {/* Записи доступны только у сохранённой книги (нужен её id). */}
          {id !== undefined && (
            <>
              {entryEdit !== null ? (
                <EntryEditor
                  bookId={id}
                  initial={entryEdit === "new" ? undefined : entryEdit}
                  onSaved={() => {
                    setEntryEdit(null);
                    reloadEntries();
                  }}
                  onCancel={() => setEntryEdit(null)}
                />
              ) : (
                <Section header="Записи">
                  {entries.length === 0 && <Cell subtitle="Пока пусто">Нет записей</Cell>}
                  {entries.map((e) => (
                    <Cell
                      key={e.id}
                      before={e.characterId != null ? <User size={20} /> : <FileText size={20} />}
                      subtitle={
                        e.characterId != null
                          ? (e.characterName ?? "персонаж удалён")
                          : e.content.slice(0, 60)
                      }
                      onClick={() => setEntryEdit(e)}
                    >
                      {e.name || (e.characterId != null ? e.characterName : "Без названия") || "Запись"}
                      {!e.enabled && " (выкл.)"}
                    </Cell>
                  ))}
                  <div style={{ padding: 16 }}>
                    <Button
                      size="m"
                      stretched
                      mode="outline"
                      disabled={atLimit}
                      before={<Plus size={18} />}
                      onClick={() => setEntryEdit("new")}
                    >
                      Добавить запись
                    </Button>
                  </div>
                  <p className="section-note">Записи always_on всегда попадают в промпт истории</p>
                </Section>
              )}
            </>
          )}
        </List>
      </div>
    </PageTransition>
  );
}
