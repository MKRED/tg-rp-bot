import { Button, Caption, Cell, List, Section, Spinner } from "@telegram-apps/telegram-ui";
import { useNavigate } from "react-router-dom";
import { ROUTES, personaEditPath } from "../../app/routes";
import { MAX_PERSONAS_PER_USER, PersonaAvatar, usePersonas } from "../../features/personas";
import "./personas.css";

/** Экран «Персоны»: список персон пользователя + кнопка создания. */
export function PersonasListPage() {
  const navigate = useNavigate();
  const { items, loading, error } = usePersonas();

  const atLimit = items.length >= MAX_PERSONAS_PER_USER;

  return (
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
            items.map((p) => (
              <Cell
                key={p.id}
                before={<PersonaAvatar id={p.id} hasImage={p.hasImage} name={p.name} />}
                subtitle={p.footnote ?? undefined}
                onClick={() => navigate(personaEditPath(p.id))}
              >
                {p.name}
              </Cell>
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
  );
}
