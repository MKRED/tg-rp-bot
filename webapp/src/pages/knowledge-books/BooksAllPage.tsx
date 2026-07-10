import { Cell, List, Spinner } from "@telegram-apps/telegram-ui";
import { motion } from "framer-motion";
import { bookEditPath } from "../../app/routes";
import { useTransitionNavigate } from "../../app/useTransitionNavigate";
import { PageTransition } from "../../shared/components/PageTransition";
import { SectionWithFooter } from "../../shared/components/SectionWithFooter";
import { BookCard, useBooks } from "../../features/knowledge-books";
import "./knowledge-books.css";

/**
 * Полный список книг знаний (открывается из хаба кнопкой «Посмотреть все»). Книг максимум
 * MAX_BOOKS_PER_USER (50), поэтому пагинация не нужна — грузим и показываем все.
 */
export function BooksAllPage() {
  const navigate = useTransitionNavigate();
  const { items, loading, error } = useBooks();

  return (
    <PageTransition>
      <div className="kb-page">
        <List>
          <SectionWithFooter
            header="Все книги знаний"
            footer="Персонажи и факты мира для режима «Режиссёр истории»"
          >
            {loading && (
              <div className="kb-hub__center">
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
                  transition={{ delay: i * 0.04, duration: 0.2, ease: "easeOut" }}
                >
                  <BookCard book={b} onClick={() => navigate(bookEditPath(b.id))} />
                </motion.div>
              ))}
          </SectionWithFooter>
        </List>
      </div>
    </PageTransition>
  );
}
