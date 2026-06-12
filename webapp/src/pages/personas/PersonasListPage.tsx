import { Button, Caption, Cell, List, Section, Spinner } from "@telegram-apps/telegram-ui";
import { motion } from "framer-motion";
import { ROUTES, personaEditPath } from "../../app/routes";
import { useTransitionNavigate } from "../../app/useTransitionNavigate";
import { PageTransition } from "../../shared/components/PageTransition";
import { MAX_PERSONAS_PER_USER, PersonaAvatar, usePersonas } from "../../features/personas";
import "./personas.css";

/** Экран «Персоны»: список персон пользователя + кнопка создания. */
export function PersonasListPage() {
  const navigate = useTransitionNavigate();
  const { items, loading, error } = usePersonas();

  const atLimit = items.length >= MAX_PERSONAS_PER_USER;

  return (
    <PageTransition>
      <div className="personas-page">
        <List>
          <Section header="Персоны">
            {loading && (
              <div className="personas-page__center">
                <Spinner size="m" />
              </div>
            )}

            {!loading && error && (
              <Cell subtitle="Не удалось загрузить список">Ошибка</Cell>
            )}

            {!loading && !error && items.length === 0 && (
              <Cell subtitle="Пока нет персон — создайте первую">Пусто</Cell>
            )}

            {!loading &&
              !error &&
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
              ))}
          </Section>

          <div className="personas-page__create">
            <Button
              size="l"
              stretched
              disabled={atLimit}
              onClick={() => navigate(ROUTES.personaNew)}
            >
              + Создать персону
            </Button>
            {atLimit && (
              <Caption level="1" className="personas-page__limit">
                Достигнут лимит в {MAX_PERSONAS_PER_USER} персон
              </Caption>
            )}
          </div>
        </List>
      </div>
    </PageTransition>
  );
}
