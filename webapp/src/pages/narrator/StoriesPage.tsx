import { Button, Cell, List, Section, Spinner } from "@telegram-apps/telegram-ui";
import { Clapperboard } from "lucide-react";
import { motion } from "framer-motion";
import { ROUTES, storyViewPath } from "../../app/routes";
import { useTransitionNavigate } from "../../app/useTransitionNavigate";
import { PageTransition } from "../../shared/components/PageTransition";
import { useStories } from "../../features/narrator";

/** Хаб режима «Режиссёр истории»: список историй + кнопка создания. */
export function StoriesPage() {
  const navigate = useTransitionNavigate();
  const { items, loading, error } = useStories();

  return (
    <PageTransition>
      <div style={{ paddingBottom: 24 }}>
        <List>
          <Section header="Режиссёр истории" footer="ИИ ведёт историю, вы направляете её директивами">
            {loading && (
              <div style={{ display: "flex", justifyContent: "center", padding: 24 }}>
                <Spinner size="m" />
              </div>
            )}
            {!loading && error && <Cell subtitle="Не удалось загрузить список">Ошибка</Cell>}
            {!loading && !error && items.length === 0 && (
              <Cell subtitle="Пока нет историй — создайте первую">Пусто</Cell>
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
                  <Cell
                    before={<Clapperboard size={24} />}
                    subtitle={s.lastMessage ?? s.bookName}
                    onClick={() => navigate(storyViewPath(s.id))}
                  >
                    {s.title ?? s.bookName}
                  </Cell>
                </motion.div>
              ))}
          </Section>
          <div style={{ padding: 16 }}>
            <Button size="l" stretched onClick={() => navigate(ROUTES.storyNew)}>
              + Новая история
            </Button>
          </div>
        </List>
      </div>
    </PageTransition>
  );
}
