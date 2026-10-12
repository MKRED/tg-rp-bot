import { MessagesSquare } from "lucide-react";
import { ROUTES, chatViewPath } from "../../app/routes";
import { useTransitionNavigate } from "../../app/useTransitionNavigate";
import { InfiniteSentinel } from "../../shared/components/InfiniteSentinel";
import { ListPage } from "../../shared/components/ListPage";
import { ChatRow, useChats } from "../../features/rp-chat";

/**
 * Хаб «Ролевой чат»: все чаты и создание нового. У чатов, в отличие от персонажей и персон, нет лимита
 * на пользователя — список подгружается страницами по мере прокрутки (useChats/useInfiniteList).
 */
export function RpChatsPage() {
  const navigate = useTransitionNavigate();
  const { items, loading, loadingMore, error, loadMoreError, hasMore, loadMore } = useChats();

  return (
    <ListPage
      title="Ролевой чат"
      description="Личные диалоги с вашими персонажами"
      icon={MessagesSquare}
      loading={loading}
      error={error}
      count={items.length}
      createLabel="Начать чат"
      emptyTitle="Чатов пока нет"
      emptyDescription="Выберите персонажа, свою персону и RP-шаблон — и начните диалог."
      onCreate={() => navigate(ROUTES.chatNew)}
      footer={<InfiniteSentinel hasMore={hasMore} loading={loadingMore} error={loadMoreError} onLoadMore={loadMore} />}
    >
      {items.map((chat, i) => (
        <ChatRow key={chat.id} chat={chat} index={i} onClick={() => navigate(chatViewPath(chat.id))} />
      ))}
    </ListPage>
  );
}
