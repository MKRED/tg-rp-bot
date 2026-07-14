import { Banner, Button, Cell, List, Section, Spinner } from "@telegram-apps/telegram-ui";
import { motion } from "framer-motion";
import { MessagesSquare } from "lucide-react";
import { ROUTES, chatViewPath } from "../../app/routes";
import { useTransitionNavigate } from "../../app/useTransitionNavigate";
import { PageTransition } from "../../shared/components/PageTransition";
import { InfiniteSentinel } from "../../shared/components/InfiniteSentinel";
import { ChatCard, useChats } from "../../features/rp-chat";
import "./rp-chat.css";

/**
 * Хаб «Ролевой чат»: все чаты + кнопка создания. Страница НЕ скроллится целиком — те же две
 * секции в одном List, что и в остальных хабах (Персонажи/Персоны/Книги знаний): секция списка
 * растянута на всю высоту (скролл ВНУТРИ её карточки), секция кнопки докнута к нижней кромке.
 * У чатов, в отличие от персонажей/персон/книг, нет лимита MAX_..._PER_USER — список потенциально
 * неограничен, поэтому вместо одноразовой загрузки всех записей используется бесконечный скролл
 * (InfiniteSentinel + useChats/useInfiniteList, аппенд страниц по 50).
 */
export function RpChatsPage() {
  const navigate = useTransitionNavigate();
  const { items, loading, loadingMore, error, loadMoreError, hasMore, loadMore } = useChats();

  return (
    <PageTransition>
      <div className="rp-chats-hub">
        <Banner
          type="section"
          before={<MessagesSquare size={28} className="rp-chats-hub__banner-icon" />}
          header="Ролевой чат"
          description="Личные диалоги с вашими персонажами"
        />

        <List className="rp-chats-hub__list">
          {/* Section вставляет Divider между прямыми детьми по позиции — единственное top-level
              выражение (тернарник) не даёт паразитных пустых слотов между loading/error/пусто;
              для списка ветка возвращает массив items.map(...) + сентинел последним элементом,
              чтобы Section развернул его как единый массив и расставил разделители между карточками. */}
          <Section className="rp-chats-hub__list-section">
            {loading ? (
              <div className="rp-chats-hub__center">
                <Spinner size="m" />
              </div>
            ) : error ? (
              <Cell subtitle="Не удалось загрузить список">Ошибка</Cell>
            ) : items.length === 0 ? (
              <Cell subtitle="Создайте первый чат с персонажем">Чатов пока нет</Cell>
            ) : (
              [
                ...items.map((chat, i) => (
                  <motion.div
                    key={chat.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(i, 10) * 0.05, duration: 0.2, ease: "easeOut" }}
                  >
                    <ChatCard chat={chat} onClick={() => navigate(chatViewPath(chat.id))} />
                  </motion.div>
                )),
                <InfiniteSentinel
                  key="sentinel"
                  hasMore={hasMore}
                  loading={loadingMore}
                  error={loadMoreError}
                  onLoadMore={loadMore}
                />,
              ]
            )}
          </Section>

          {/* Вторая секция — кнопка создания. Один div-ребёнок: Section вставляет Divider между
              несколькими детьми, а тут нужен цельный блок без разделителя. */}
          <Section className="rp-chats-hub__actions-section">
            <div className="rp-chats-hub__create">
              <Button size="l" stretched onClick={() => navigate(ROUTES.chatNew)}>
                + Новый чат
              </Button>
            </div>
          </Section>
        </List>
      </div>
    </PageTransition>
  );
}
