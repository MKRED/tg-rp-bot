import { Avatar, Caption, Cell, List, Section, Title } from "@telegram-apps/telegram-ui";
import { MessageCircle, Users, User, Smile, SlidersHorizontal } from "lucide-react";
import { motion } from "framer-motion";
import { useState } from "react";
import { ROUTES } from "../../app/routes";
import { useTransitionNavigate } from "../../app/useTransitionNavigate";
import { PageTransition } from "../../shared/components/PageTransition";
import { getTgUser } from "../../shared/telegram/initData";
import { useProfilePhoto } from "../../shared/telegram/useProfilePhoto";
import { randomGreeting } from "./greetings";
import "./home.css";

function initialsOf(fullName: string): string {
  return fullName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]!.toUpperCase())
    .join("");
}

// Паттерн анимации для каждого пункта меню: каждый item — отдельный прямой child Section,
// чтобы Section.React.Children.map мог вставить Divider между ними.
// Задержки указаны явно (а не staggerChildren) по той же причине: stagger-контейнер
// схлопывает все items в одного child и ломает вставку разделителей.
const itemTransition = { duration: 0.2, ease: "easeOut" as const };
const itemInitial = { opacity: 0, y: 8 };
const itemAnimate = { opacity: 1, y: 0 };

export function HomePage() {
  const navigate = useTransitionNavigate();
  const user = getTgUser();
  const photoUrl = useProfilePhoto();
  // Приветствие фиксируется при монтировании — одно на сессию, не мигает при ре-рендерах.
  const [greeting] = useState(() => randomGreeting());

  const displayName = user?.firstName ?? "Гость";
  const handle = user?.username ? `@${user.username}` : "не в Telegram";

  return (
    <PageTransition>
      <div className="home">
        <header className="home__greeting">
          <Avatar size={96} src={photoUrl} acronym={user ? initialsOf(user.fullName) : undefined} />
          <Title level="1" weight="2" className="home__name">
            {greeting}, {displayName}!
          </Title>
          <Caption level="1" className="home__handle">
            {handle}
          </Caption>
        </header>

        <List>
          <Section header="Режим игры">
            <motion.div initial={itemInitial} animate={itemAnimate} transition={{ ...itemTransition, delay: 0 }}>
              <Cell
                before={<MessageCircle size={24} className="home__icon" />}
                subtitle="Диалог с одним персонажем"
                onClick={() => navigate(ROUTES.chats)}
              >
                Ролевой чат
              </Cell>
            </motion.div>
            <motion.div initial={itemInitial} animate={itemAnimate} transition={{ ...itemTransition, delay: 0.05 }}>
              <Cell
                before={<Users size={24} className="home__icon home__icon--muted" />}
                subtitle="В разработке"
                after={<span className="home__soon-badge">Скоро</span>}
                className="home__cell--soon"
              >
                Группа персонажей
              </Cell>
            </motion.div>
          </Section>

          <Section header="Библиотека">
            <motion.div initial={itemInitial} animate={itemAnimate} transition={{ ...itemTransition, delay: 0.1 }}>
              <Cell
                before={<User size={24} className="home__icon" />}
                subtitle="Ваши персонажи"
                onClick={() => navigate(ROUTES.characters)}
              >
                Персонажи
              </Cell>
            </motion.div>
            <motion.div initial={itemInitial} animate={itemAnimate} transition={{ ...itemTransition, delay: 0.15 }}>
              <Cell
                before={<Smile size={24} className="home__icon" />}
                subtitle="Ваши персоны (от чьего лица вы играете)"
                onClick={() => navigate(ROUTES.personas)}
              >
                Персоны
              </Cell>
            </motion.div>
            <motion.div initial={itemInitial} animate={itemAnimate} transition={{ ...itemTransition, delay: 0.2 }}>
              <Cell
                before={<SlidersHorizontal size={24} className="home__icon" />}
                subtitle="Пресеты параметров генерации"
                onClick={() => navigate(ROUTES.presets)}
              >
                Настройки ответа ИИ
              </Cell>
            </motion.div>
          </Section>
        </List>
      </div>
    </PageTransition>
  );
}
