import { Text } from "@mantine/core";
import { Sparkles } from "lucide-react";
import { ROUTES, cardEditPath } from "../../app/routes";
import { useTransitionNavigate } from "../../app/useTransitionNavigate";
import { MAX_CARDS_PER_USER, useCards } from "../../features/cards";
import { ListRow } from "../../shared/components/ListCard";
import { ListPage } from "../../shared/components/ListPage";
import { formatRelativeDate } from "../../shared/text/formatRelativeDate";

/** Хаб «Мастерская»: все карточки-черновики персонажей и персон и создание новой. */
export function CardsListPage() {
  const navigate = useTransitionNavigate();
  const { items, loading, error } = useCards();

  return (
    <ListPage
      title="Карточки"
      description="Мастерская — крафт карточек персонажей и персон"
      icon={Sparkles}
      loading={loading}
      error={error}
      count={items.length}
      limit={MAX_CARDS_PER_USER}
      limitText={`Достигнут лимит в ${MAX_CARDS_PER_USER} карточек`}
      createLabel="Создать карточку"
      emptyTitle="Пока нет карточек"
      emptyDescription="Карточка — черновик персонажа или персоны: нейросеть пишет её блок за блоком по вашей структуре, а готовую можно выгрузить."
      onCreate={() => navigate(ROUTES.cardNew)}
    >
      {items.map((c, i) => (
        <ListRow
          key={c.id}
          index={i}
          title={c.name}
          meta={
            <Text size="xs" c="dimmed">
              {formatRelativeDate(c.updatedAt)}
            </Text>
          }
          onClick={() => navigate(cardEditPath(c.id))}
        />
      ))}
    </ListPage>
  );
}
