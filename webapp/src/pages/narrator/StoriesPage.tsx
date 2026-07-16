import { Banner, Button, Cell, List, Section, Spinner } from "@telegram-apps/telegram-ui";
import { motion } from "framer-motion";
import { Clapperboard } from "lucide-react";
import { ROUTES, storyViewPath } from "../../app/routes";
import { useTransitionNavigate } from "../../app/useTransitionNavigate";
import { PageTransition } from "../../shared/components/PageTransition";
import { InfiniteSentinel } from "../../shared/components/InfiniteSentinel";
import { StoryCard, useStories } from "../../features/narrator";
import "./narrator.css";

/**
 * Хаб «Режиссёр истории»: все истории + кнопка создания. Страница НЕ скроллится целиком — те же
 * две секции в одном List, что и в остальных хабах: секция списка растянута на всю высоту (скролл
 * ВНУТРИ её карточки), секция кнопки докнута к нижней кромке. У историй, как и у чатов, нет лимита
 * MAX_..._PER_USER, поэтому список грузится бесконечным скроллом (InfiniteSentinel + useStories/
 * useInfiniteList, аппенд страниц по 10 — меньше дефолта хабов из-за батч-догрузки аватаров
 * AvatarStack на каждой карточке, см. useStories.ts) вместо одноразовой загрузки всех записей.
 */
export function StoriesPage() {
  const navigate = useTransitionNavigate();
  const { items, loading, loadingMore, error, loadMoreError, hasMore, loadMore } = useStories();

  return (
    <PageTransition>
      <div className="stories-hub">
        <Banner
          type="section"
          before={<Clapperboard size={28} className="stories-hub__banner-icon" />}
          header="Режиссёр истории"
          description="ИИ ведёт историю, вы направляете её директивами"
        />

        <List className="stories-hub__list">
          {/* Section вставляет Divider между прямыми детьми по позиции — единственное top-level
              выражение (тернарник) не даёт паразитных пустых слотов между loading/error/пусто;
              для списка ветка возвращает массив items.map(...) + сентинел последним элементом,
              чтобы Section развернул его как единый массив и расставил разделители между карточками. */}
          <Section className="stories-hub__list-section">
            {loading ? (
              <div className="stories-hub__center">
                <Spinner size="m" />
              </div>
            ) : error ? (
              <Cell subtitle="Не удалось загрузить список">Ошибка</Cell>
            ) : items.length === 0 ? (
              <Cell subtitle="Пока нет историй — создайте первую">Пусто</Cell>
            ) : (
              [
                ...items.map((s, i) => (
                  <motion.div
                    key={s.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(i, 10) * 0.05, duration: 0.2, ease: "easeOut" }}
                  >
                    <StoryCard story={s} onClick={() => navigate(storyViewPath(s.id))} />
                  </motion.div>
                )),
                <InfiniteSentinel
                  key="sentinel"
                  hasMore={hasMore}
                  loading={loadingMore}
                  error={loadMoreError}
                  onLoadMore={loadMore}
                />,
              ]
            )}
          </Section>

          {/* Вторая секция — кнопка создания. Один div-ребёнок: Section вставляет Divider между
              несколькими детьми, а тут нужен цельный блок без разделителя. */}
          <Section className="stories-hub__actions-section">
            <div className="stories-hub__create">
              <Button size="l" stretched onClick={() => navigate(ROUTES.storyNew)}>
                + Новая история
              </Button>
            </div>
          </Section>
        </List>
      </div>
    </PageTransition>
  );
}
