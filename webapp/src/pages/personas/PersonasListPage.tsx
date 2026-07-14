import { Banner, Button, Caption, Cell, List, Section, Spinner } from "@telegram-apps/telegram-ui";
import { motion } from "framer-motion";
import { UserRound } from "lucide-react";
import { ROUTES, personaEditPath } from "../../app/routes";
import { useTransitionNavigate } from "../../app/useTransitionNavigate";
import { PageTransition } from "../../shared/components/PageTransition";
import { MAX_PERSONAS_PER_USER, PersonaAvatar, usePersonas } from "../../features/personas";
import "./personas.css";

/**
 * Хаб «Персоны»: все персоны + кнопка создания. Страница НЕ скроллится целиком — две
 * секции в одном List: секция списка растянута на всю высоту (скролл ВНУТРИ её карточки),
 * секция кнопки докнута к нижней кромке (тот же приём, что в хабе «Персонажи»/«Книги знаний»).
 */
export function PersonasListPage() {
  const navigate = useTransitionNavigate();
  const { items, loading, error } = usePersonas();

  const atLimit = items.length >= MAX_PERSONAS_PER_USER;

  return (
    <PageTransition>
      <div className="personas-hub">
        <Banner
          type="section"
          before={<UserRound size={28} className="personas-hub__banner-icon" />}
          header="Персоны"
          description="Ваш альтер-эго в ролевых чатах"
        />

        <List className="personas-hub__list">
          {/* Section вставляет Divider между прямыми детьми по позиции — единственное top-level
              выражение (тернарник) не даёт паразитных пустых слотов между loading/error/пусто;
              для списка ветка возвращает items.map(...) НЕ обёрнутым во Fragment, чтобы Section
              развернул его как массив и расставил разделители между карточками. */}
          <Section className="personas-hub__list-section">
            {loading ? (
              <div className="personas-hub__center">
                <Spinner size="m" />
              </div>
            ) : error ? (
              <Cell subtitle="Не удалось загрузить список">Ошибка</Cell>
            ) : items.length === 0 ? (
              <Cell subtitle="Пока нет персон — создайте первую">Пусто</Cell>
            ) : (
              items.map((p, i) => (
                <motion.div
                  key={p.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05, duration: 0.2, ease: "easeOut" }}
                >
                  <Cell
                    before={<PersonaAvatar id={p.id} hasImage={p.hasImage} name={p.name} size={48} enlargeable />}
                    subtitle={p.footnote ?? undefined}
                    onClick={() => navigate(personaEditPath(p.id))}
                  >
                    {p.name}
                  </Cell>
                </motion.div>
              ))
            )}
          </Section>

          {/* Вторая секция — кнопка создания. Один div-ребёнок: Section вставляет Divider между
              несколькими детьми, а тут нужен цельный блок без разделителя. */}
          <Section className="personas-hub__actions-section">
            <div className="personas-hub__create">
              <Button
                size="l"
                stretched
                disabled={atLimit}
                onClick={() => navigate(ROUTES.personaNew)}
              >
                + Создать персону
              </Button>
              {atLimit && (
                <Caption level="1" className="personas-hub__limit">
                  Достигнут лимит в {MAX_PERSONAS_PER_USER} персон
                </Caption>
              )}
            </div>
          </Section>
        </List>
      </div>
    </PageTransition>
  );
}
