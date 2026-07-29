import { Banner, Button, Caption, Cell, Info, List, Section, Spinner } from "@telegram-apps/telegram-ui";
import { motion } from "framer-motion";
import { Sparkles } from "lucide-react";
import { ROUTES, cardEditPath } from "../../app/routes";
import { useTransitionNavigate } from "../../app/useTransitionNavigate";
import { PageTransition } from "../../shared/components/PageTransition";
import { formatRelativeDate } from "../../shared/text/formatRelativeDate";
import { MAX_CARDS_PER_USER, useCards } from "../../features/cards";
import "./cards.css";

/**
 * Экран «Мастерская»: все карточки-черновики + кнопка создания. Страница НЕ скроллится целиком —
 * две секции в одном List: секция списка растянута на всю высоту (скролл ВНУТРИ её карточки),
 * секция кнопки докнута к нижней кромке (тот же приём, что в хабе «Персонажи»).
 */
export function CardsListPage() {
  const navigate = useTransitionNavigate();
  const { items, loading, error } = useCards();

  const atLimit = items.length >= MAX_CARDS_PER_USER;

  return (
    <PageTransition>
      <div className="cards-hub">
        <Banner
          type="section"
          before={<Sparkles size={28} className="cards-hub__banner-icon" />}
          header="Карточки"
          description="Мастерская — крафт карточек персонажей и персон"
        />

        <List className="cards-hub__list">
          {/* Section вставляет Divider между прямыми детьми по позиции — единственное top-level
              выражение (тернарник) не даёт паразитных пустых слотов между loading/error/пусто;
              для списка ветка возвращает items.map(...) НЕ обёрнутым во Fragment, чтобы Section
              развернул его как массив и расставил разделители между карточками. */}
          <Section className="cards-hub__list-section">
            {loading ? (
              <div className="cards-hub__center">
                <Spinner size="m" />
              </div>
            ) : error ? (
              <Cell subtitle="Не удалось загрузить список">Ошибка</Cell>
            ) : items.length === 0 ? (
              <Cell subtitle="Пока нет карточек — создайте первую">Пусто</Cell>
            ) : (
              items.map((c, i) => (
                <motion.div
                  key={c.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05, duration: 0.2, ease: "easeOut" }}
                >
                  <Cell
                    after={<Info type="text" subtitle={formatRelativeDate(c.updatedAt)} />}
                    onClick={() => navigate(cardEditPath(c.id))}
                  >
                    {c.name}
                  </Cell>
                </motion.div>
              ))
            )}
          </Section>

          {/* Вторая секция — кнопка создания. Один div-ребёнок: Section вставляет Divider между
              несколькими детьми, а тут нужен цельный блок без разделителя. */}
          <Section className="cards-hub__actions-section">
            <div className="cards-hub__create">
              <Button
                size="l"
                stretched
                disabled={atLimit}
                onClick={() => navigate(ROUTES.cardNew)}
              >
                + Создать карточку
              </Button>
              {atLimit && (
                <Caption level="1" className="cards-hub__limit">
                  Достигнут лимит в {MAX_CARDS_PER_USER} карточек
                </Caption>
              )}
            </div>
          </Section>
        </List>
      </div>
    </PageTransition>
  );
}
