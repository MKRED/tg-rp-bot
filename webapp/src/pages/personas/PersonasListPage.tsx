import { UserRound } from "lucide-react";
import { ROUTES, personaEditPath } from "../../app/routes";
import { useTransitionNavigate } from "../../app/useTransitionNavigate";
import { MAX_PERSONAS_PER_USER, PersonaAvatar, usePersonas } from "../../features/personas";
import { ListRow } from "../../shared/components/ListCard";
import { ListPage } from "../../shared/components/ListPage";

/** Хаб «Персоны»: все персоны пользователя и создание новой. */
export function PersonasListPage() {
  const navigate = useTransitionNavigate();
  const { items, loading, error } = usePersonas();

  return (
    <ListPage
      title="Персоны"
      description="Ваш альтер-эго в ролевых чатах"
      icon={UserRound}
      loading={loading}
      error={error}
      count={items.length}
      limit={MAX_PERSONAS_PER_USER}
      limitText={`Достигнут лимит в ${MAX_PERSONAS_PER_USER} персон`}
      createLabel="Создать персону"
      emptyTitle="Пока нет персон"
      emptyDescription="Персона — это вы в ролевом чате: имя, внешность и описание для нейросети."
      onCreate={() => navigate(ROUTES.personaNew)}
    >
      {items.map((p, i) => (
        <ListRow
          key={p.id}
          index={i}
          // Аватар с фото — своя кнопка (лайтбокс), тап по остальной строке открывает персону.
          leading={<PersonaAvatar id={p.id} hasImage={p.hasImage} name={p.name} size={48} enlargeable />}
          title={p.name}
          description={p.footnote ?? undefined}
          onClick={() => navigate(personaEditPath(p.id))}
        />
      ))}
    </ListPage>
  );
}
