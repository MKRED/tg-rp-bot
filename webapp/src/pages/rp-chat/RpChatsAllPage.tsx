import { Button, Cell, List, Section, Spinner } from "@telegram-apps/telegram-ui";
import { motion } from "framer-motion";
import { chatViewPath } from "../../app/routes";
import { useTransitionNavigate } from "../../app/useTransitionNavigate";
import { PageTransition } from "../../shared/components/PageTransition";
import { ChatCard } from "../../features/rp-chat/components/ChatCard";
import { useAllChats } from "../../features/rp-chat/hooks/useAllChats";
import "./rp-chat.css";

/** Полный список чатов с постраничной навигацией. */
export function RpChatsAllPage() {
  const navigate = useTransitionNavigate();
  const { items, loading, error, page, setPage, hasMore } = useAllChats();

  return (
    <PageTransition>
      <div className="rp-chats-all-page">
        <List>
          <Section header="Все чаты">
            {loading && (
              <div className="rp-chats-all-page__center">
                <Spinner size="m" />
              </div>
            )}
            {!loading && error && (
              <Cell subtitle="Не удалось загрузить список">Ошибка</Cell>
            )}
            {!loading && !error && items.length === 0 && (
              <Cell subtitle="Создайте первый чат с персонажем">Чатов пока нет</Cell>
            )}
            {!loading &&
              !error &&
              items.map((chat, i) => (
                <motion.div
                  key={chat.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04, duration: 0.2, ease: "easeOut" }}
                >
                  <ChatCard
                    chat={chat}
                    onClick={() => navigate(chatViewPath(chat.id))}
                  />
                </motion.div>
              ))}
          </Section>
        </List>

        {(page > 1 || hasMore) && (
          <div className="rp-chats-all-page__pagination">
            <Button
              size="m"
              mode="outline"
              stretched
              disabled={page === 1 || loading}
              onClick={() => setPage(page - 1)}
            >
              ← Назад
            </Button>
            <Button
              size="m"
              mode="outline"
              stretched
              disabled={!hasMore || loading}
              onClick={() => setPage(page + 1)}
            >
              Вперёд →
            </Button>
          </div>
        )}
      </div>
    </PageTransition>
  );
}
