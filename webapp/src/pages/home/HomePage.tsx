import { Avatar, Caption, Cell, List, Section, Title } from "@telegram-apps/telegram-ui";
import { MessageCircle, Users, User, Smile, SlidersHorizontal } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { getTgUser } from "../../shared/telegram/initData";
import { useProfilePhoto } from "../../shared/telegram/useProfilePhoto";
import { ROUTES } from "../../app/routes";
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

export function HomePage() {
  const navigate = useNavigate();
  const user = getTgUser();
  const photoUrl = useProfilePhoto();
  // Приветствие фиксируется при монтировании — одно на сессию, не мигает при ре-рендерах.
  const [greeting] = useState(() => randomGreeting());

  const displayName = user?.firstName ?? "Гость";
  const handle = user?.username ? `@${user.username}` : "не в Telegram";

  return (
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
          <Cell
            before={<MessageCircle size={24} className="home__icon" />}
            subtitle="Диалог с одним персонажем"
            onClick={() => navigate(ROUTES.chat)}
          >
            Ролевой чат
          </Cell>
          <Cell
            before={<Users size={24} className="home__icon home__icon--muted" />}
            subtitle="В разработке"
            after={<span className="home__soon-badge">Скоро</span>}
            className="home__cell--soon"
          >
            Группа персонажей
          </Cell>
        </Section>

        <Section header="Библиотека">
          <Cell
            before={<User size={24} className="home__icon" />}
            subtitle="Ваши персонажи"
            onClick={() => navigate(ROUTES.characters)}
          >
            Персонажи
          </Cell>
          <Cell
            before={<Smile size={24} className="home__icon" />}
            subtitle="Ваши персоны (от чьего лица вы играете)"
            onClick={() => navigate(ROUTES.personas)}
          >
            Персоны
          </Cell>
          <Cell
            before={<SlidersHorizontal size={24} className="home__icon" />}
            subtitle="Пресеты параметров генерации"
            onClick={() => navigate(ROUTES.presets)}
          >
            Настройки ответа ИИ
          </Cell>
        </Section>
      </List>
    </div>
  );
}
