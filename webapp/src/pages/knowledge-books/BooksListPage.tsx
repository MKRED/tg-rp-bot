import { Button, Cell, List, Section, Spinner } from "@telegram-apps/telegram-ui";
import { BookOpen } from "lucide-react";
import { motion } from "framer-motion";
import { ROUTES, bookEditPath } from "../../app/routes";
import { useTransitionNavigate } from "../../app/useTransitionNavigate";
import { PageTransition } from "../../shared/components/PageTransition";
import { MAX_BOOKS_PER_USER, useBooks } from "../../features/knowledge-books";
import "./knowledge-books.css";

/** Экран «Книги знаний»: список lorebook'ов + кнопка создания. */
export function BooksListPage() {
  const navigate = useTransitionNavigate();
  const { items, loading, error } = useBooks();
  const atLimit = items.length >= MAX_BOOKS_PER_USER;

  return (
    <PageTransition>
      <div className="kb-page">
        <List>
          <Section header="Книги знаний" footer="Персонажи и факты мира для режима «Режиссёр истории»">
            {loading && (
              <div style={{ display: "flex", justifyContent: "center", padding: 24 }}>
                <Spinner size="m" />
              </div>
            )}
            {!loading && error && <Cell subtitle="Не удалось загрузить список">Ошибка</Cell>}
            {!loading && !error && items.length === 0 && (
              <Cell subtitle="Пока нет книг — создайте первую">Пусто</Cell>
            )}
            {!loading &&
              !error &&
              items.map((b, i) => (
                <motion.div
                  key={b.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05, duration: 0.2, ease: "easeOut" }}
                >
                  <Cell
                    before={<BookOpen size={24} />}
                    subtitle={b.description ?? `${b.entryCount} записей`}
                    onClick={() => navigate(bookEditPath(b.id))}
                  >
                    {b.name}
                  </Cell>
                </motion.div>
              ))}
          </Section>

          <div style={{ padding: 16 }}>
            <Button size="l" stretched disabled={atLimit} onClick={() => navigate(ROUTES.bookNew)}>
              + Создать книгу
            </Button>
          </div>
        </List>
      </div>
    </PageTransition>
  );
}
