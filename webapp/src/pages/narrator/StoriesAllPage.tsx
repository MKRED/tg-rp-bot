import { Button, Cell, List, Section, Spinner } from "@telegram-apps/telegram-ui";
import { motion } from "framer-motion";
import { storyViewPath } from "../../app/routes";
import { useTransitionNavigate } from "../../app/useTransitionNavigate";
import { PageTransition } from "../../shared/components/PageTransition";
import { StoryCard, useAllStories } from "../../features/narrator";
import "./narrator.css";

/** Полный список историй с постраничной навигацией. */
export function StoriesAllPage() {
  const navigate = useTransitionNavigate();
  const { items, loading, error, page, setPage, hasMore } = useAllStories();

  return (
    <PageTransition>
      <div className="story-list-page">
        <List>
          <Section header="Все истории">
            {loading && (
              <div className="story-list-page__center">
                <Spinner size="m" />
              </div>
            )}
            {!loading && error && <Cell subtitle="Не удалось загрузить список">Ошибка</Cell>}
            {!loading && !error && items.length === 0 && (
              <Cell subtitle="ИИ ведёт историю, вы направляете её директивами">Историй пока нет</Cell>
            )}
            {!loading &&
              !error &&
              items.map((s, i) => (
                <motion.div
                  key={s.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04, duration: 0.2, ease: "easeOut" }}
                >
                  <StoryCard story={s} onClick={() => navigate(storyViewPath(s.id))} />
                </motion.div>
              ))}
          </Section>
        </List>

        {(page > 1 || hasMore) && (
          <div className="story-list-page__pagination">
            <Button
              size="m"
              mode="outline"
              stretched
              disabled={page === 1 || loading}
              onClick={() => setPage(page - 1)}
            >
              ← Назад
            </Button>
            <Button
              size="m"
              mode="outline"
              stretched
              disabled={!hasMore || loading}
              onClick={() => setPage(page + 1)}
            >
              Вперёд →
            </Button>
          </div>
        )}
      </div>
    </PageTransition>
  );
}
