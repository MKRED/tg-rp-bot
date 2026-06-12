import { Cell, List, Section, Spinner } from "@telegram-apps/telegram-ui";
import { motion } from "framer-motion";
import { ChevronRight, MessageCirclePlus, MessagesSquare } from "lucide-react";
import { useTransitionNavigate } from "../../app/useTransitionNavigate";
import { ROUTES } from "../../app/routes";
import { PageTransition } from "../../shared/components/PageTransition";
import { ChatCard } from "../../features/rp-chat/components/ChatCard";
import { useRecentChats } from "../../features/rp-chat/hooks/useRecentChats";
import "./rp-chat.css";

/** Хаб «Ролевой чат»: последние 5 чатов + ссылки на все чаты и создание нового. */
export function RpChatsPage() {
  const navigate = useTransitionNavigate();
  const { items, loading, error } = useRecentChats(5);

  return (
    <PageTransition>
      <div className="rp-chats-page">
        <List>
          <Section header="Последние чаты">
            {loading && (
              <div className="rp-chats-page__center">
                <Spinner size="m" />
              </div>
            )}
            {!loading && error && (
              <Cell subtitle="Не удалось загрузить чаты">Ошибка</Cell>
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
                  transition={{ delay: i * 0.05, duration: 0.2, ease: "easeOut" }}
                >
                  <ChatCard
                    chat={chat}
                    onClick={() => navigate(`/chats/${chat.id}`)}
                  />
                </motion.div>
              ))}
          </Section>

          <Section>
            <Cell
              before={<MessagesSquare size={24} className="rp-chats-page__icon" />}
              after={<ChevronRight size={18} className="rp-chats-page__chevron" />}
              subtitle="Полный список"
              onClick={() => navigate(ROUTES.chatAll)}
            >
              Все чаты
            </Cell>
            <Cell
              before={<MessageCirclePlus size={24} className="rp-chats-page__icon" />}
              after={<ChevronRight size={18} className="rp-chats-page__chevron" />}
              subtitle="Выбрать персонажа и начать"
              onClick={() => navigate(ROUTES.chatNew)}
            >
              Новый чат
            </Cell>
          </Section>
        </List>
      </div>
    </PageTransition>
  );
}
