import { Banner, Button, Cell, List, Section, Spinner } from "@telegram-apps/telegram-ui";
import { motion } from "framer-motion";
import { BookOpen } from "lucide-react";
import { ROUTES, bookEditPath } from "../../app/routes";
import { useTransitionNavigate } from "../../app/useTransitionNavigate";
import { PageTransition } from "../../shared/components/PageTransition";
import { BookCard, MAX_BOOKS_PER_USER, useBooks } from "../../features/knowledge-books";
import "./knowledge-books.css";

/** Сколько последних книг показываем в хабе; остальные — по кнопке «Посмотреть все». */
const RECENT_LIMIT = 5;

/**
 * Хаб «Книги знаний»: последние 5 книг + кнопки действий. Страница НЕ скроллится целиком —
 * две секции в одном List: секция списка растянута на всю высоту (скролл ВНУТРИ её карточки),
 * секция кнопок докнута к нижней кромке. Между ними — штатный 12px-отступ List («логичный
 * разрыв»). Заголовок и описание — в Banner-шапке сверху.
 */
export function BooksListPage() {
  const navigate = useTransitionNavigate();
  const { items, loading, error } = useBooks();
  const atLimit = items.length >= MAX_BOOKS_PER_USER;
  const recent = items.slice(0, RECENT_LIMIT);
  const hasMore = items.length > RECENT_LIMIT;

  return (
    <PageTransition>
      <div className="kb-hub">
        <Banner
          type="section"
          before={<BookOpen size={28} className="kb-hub__banner-icon" />}
          header="Книги знаний"
          description="Персонажи и факты мира для режима «Режиссёр истории»"
        />

        <List className="kb-hub__list">
          <Section className="kb-hub__list-section">
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
              recent.map((b, i) => (
                <motion.div
                  key={b.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05, duration: 0.2, ease: "easeOut" }}
                >
                  <BookCard book={b} onClick={() => navigate(bookEditPath(b.id))} />
                </motion.div>
              ))}
          </Section>

          {/* Вторая секция — кнопки действий. Один div-ребёнок: Section вставляет Divider между
              несколькими детьми, а тут нужна цельная строка кнопок без разделителя. */}
          <Section className="kb-hub__actions-section">
            <div className="kb-hub__actions">
              {hasMore && (
                <Button size="l" mode="outline" stretched onClick={() => navigate(ROUTES.bookAll)}>
                  Посмотреть все
                </Button>
              )}
              <Button size="l" stretched disabled={atLimit} onClick={() => navigate(ROUTES.bookNew)}>
                + Создать книгу
              </Button>
            </div>
          </Section>
        </List>
      </div>
    </PageTransition>
  );
}
