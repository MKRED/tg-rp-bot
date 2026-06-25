import { Cell, List, Section, Spinner } from "@telegram-apps/telegram-ui";
import { motion } from "framer-motion";
import { ChevronRight, Film, Plus } from "lucide-react";
import { ROUTES, storyViewPath } from "../../app/routes";
import { useTransitionNavigate } from "../../app/useTransitionNavigate";
import { PageTransition } from "../../shared/components/PageTransition";
import { StoryCard, useRecentStories } from "../../features/narrator";
import "./narrator.css";

/** Хаб режима «Режиссёр истории»: последние 5 историй + ссылки на все истории и создание новой. */
export function StoriesPage() {
  const navigate = useTransitionNavigate();
  const { items, loading, error } = useRecentStories(5);

  return (
    <PageTransition>
      <div className="story-list-page">
        <List>
          <Section header="Последние истории">
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
                  transition={{ delay: i * 0.05, duration: 0.2, ease: "easeOut" }}
                >
                  <StoryCard story={s} onClick={() => navigate(storyViewPath(s.id))} />
                </motion.div>
              ))}
          </Section>

          <Section>
            <Cell
              before={<Film size={24} className="story-list-page__icon" />}
              after={<ChevronRight size={18} className="story-list-page__chevron" />}
              subtitle="Полный список"
              onClick={() => navigate(ROUTES.storyAll)}
            >
              Все истории
            </Cell>
            <Cell
              before={<Plus size={24} className="story-list-page__icon" />}
              after={<ChevronRight size={18} className="story-list-page__chevron" />}
              subtitle="Выбрать книгу и начать"
              onClick={() => navigate(ROUTES.storyNew)}
            >
              Новая история
            </Cell>
          </Section>
        </List>
      </div>
    </PageTransition>
  );
}
