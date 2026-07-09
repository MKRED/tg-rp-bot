import { Button, Cell, List } from "@telegram-apps/telegram-ui";
import { AnimatePresence, motion } from "framer-motion";
import { Plus, FileText } from "lucide-react";
import { useState } from "react";
import { useParams } from "react-router-dom";
import { ROUTES, bookEditPath } from "../../app/routes";
import { useTransitionNavigate } from "../../app/useTransitionNavigate";
import { PageStateBoundary } from "../../shared/components/PageStateBoundary";
import { SectionWithFooter } from "../../shared/components/SectionWithFooter";
import { CharacterAvatar } from "../../features/characters";
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

// Анимация свапа «список записей ⇄ редактор записи»: лёгкий fade+slide, как у ExpandableSelect.
const swapAnim = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: 8 },
  transition: { duration: 0.2, ease: "easeOut" as const },
};

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
    const confirmed = await confirmAction("Удалить книгу знаний? Это действие необратимо.", {
      title: "Удаление книги знаний",
    });
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

  const atLimit = entries.length >= MAX_ENTRIES_PER_BOOK;

  return (
    <PageStateBoundary
      loading={loading}
      error={Boolean(error) || (id !== undefined && !book)}
      errorText="Книга не найдена"
    >
      {() => (
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
            // mode="wait" — уходящий вид доигрывает exit до входа нового (без наложения/скачка высоты);
            // initial={false} — на первом монтировании экрана список не анимируем (это делает PageTransition).
            <AnimatePresence mode="wait" initial={false}>
              {entryEdit !== null ? (
                <motion.div key="editor" {...swapAnim}>
                  <EntryEditor
                    bookId={id}
                    initial={entryEdit === "new" ? undefined : entryEdit}
                    onSaved={() => {
                      setEntryEdit(null);
                      reloadEntries();
                    }}
                    onCancel={() => setEntryEdit(null)}
                  />
                </motion.div>
              ) : (
                <motion.div key="list" {...swapAnim}>
                  <SectionWithFooter
                    header="Записи"
                    footer="Записи always_on всегда попадают в промпт истории"
                  >
                    {entries.length === 0 && <Cell subtitle="Пока пусто">Нет записей</Cell>}
                    {entries.map((e) => (
                      <Cell
                        key={e.id}
                        before={
                          e.characterId != null ? (
                            <CharacterAvatar
                              id={e.characterId}
                              hasImage={e.characterHasImage}
                              name={e.characterName ?? ""}
                              size={40}
                            />
                          ) : (
                            // Иконка 40px — тот же футпринт, что аватар персонажа, чтобы строки
                            // свободного текста и персонажа были одной высоты и текст не «прыгал».
                            <FileText size={40} strokeWidth={1.5} className="kb-entry-icon" />
                          )
                        }
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
                  </SectionWithFooter>
                </motion.div>
              )}
            </AnimatePresence>
          )}
        </List>
      </div>
      )}
    </PageStateBoundary>
  );
}
