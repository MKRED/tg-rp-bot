import { Text } from "@mantine/core";
import { Feather } from "lucide-react";
import { ROUTES, coauthorViewPath } from "../../app/routes";
import { useTransitionNavigate } from "../../app/useTransitionNavigate";
import { MAX_COAUTHOR_CHATS_PER_USER, useCoauthorChats } from "../../features/coauthor";
import { ListRow } from "../../shared/components/ListCard";
import { ListPage } from "../../shared/components/ListPage";
import { formatRelativeDate } from "../../shared/text/formatRelativeDate";

/** Хаб «Соавтора»: чаты с ИИ над несколькими карточками. */
export function CoauthorListPage() {
  const navigate = useTransitionNavigate();
  const { items, loading, error } = useCoauthorChats();

  return (
    <ListPage
      title="Соавтор"
      description="Чат с ИИ над несколькими карточками сразу"
      icon={Feather}
      loading={loading}
      error={error}
      count={items.length}
      limit={MAX_COAUTHOR_CHATS_PER_USER}
      limitText={`Достигнут лимит в ${MAX_COAUTHOR_CHATS_PER_USER} чатов`}
      createLabel="Новый чат"
      emptyTitle="Пока нет чатов"
      emptyDescription="Откройте в чате связанные карточки — например, двух сестёр — и правьте их вместе с ИИ: он видит все карточки и держит их согласованными."
      onCreate={() => navigate(ROUTES.coauthorNew)}
    >
      {items.map((chat, i) => (
        <ListRow
          key={chat.id}
          index={i}
          title={chat.name}
          description={chat.cardNames.join(", ") || "Карточки удалены"}
          meta={
            <Text size="xs" c="dimmed">
              {formatRelativeDate(chat.updatedAt)}
            </Text>
          }
          onClick={() => navigate(coauthorViewPath(chat.id))}
        />
      ))}
    </ListPage>
  );
}
