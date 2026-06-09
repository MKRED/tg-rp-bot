import { Avatar, Caption, Cell, List, Section, Title } from "@telegram-apps/telegram-ui";
import { useNavigate } from "react-router-dom";
import { getTgUser } from "../../shared/telegram/initData";
import { useProfilePhoto } from "../../shared/telegram/useProfilePhoto";
import { ROUTES } from "../../app/routes";
import "./home.css";

/** Инициалы для заглушки аватара: первые буквы имени и фамилии. */
function initialsOf(fullName: string): string {
  return fullName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]!.toUpperCase())
    .join("");
}

/**
 * Главная — экран, на который попадаем при открытии приложения.
 * Показывает профиль пользователя (из initData) и точки входа в режимы игры.
 */
export function HomePage() {
  const navigate = useNavigate();
  const user = getTgUser();
  // Фото грузится серверно: initData при запуске кнопкой/меню его не содержит.
  const photoUrl = useProfilePhoto();

  // Вне Telegram (dev-браузер) initData пустой — показываем нейтральную заглушку.
  const displayName = user?.fullName ?? "Гость";
  const handle = user?.username ? `@${user.username}` : "не в Telegram";

  return (
    <div className="home">
      <header className="home__greeting">
        <Avatar size={96} src={photoUrl} acronym={user ? initialsOf(user.fullName) : undefined} />
        <Title level="1" weight="2" className="home__name">
          {displayName}
        </Title>
        <Caption level="1" className="home__handle">
          {handle}
        </Caption>
      </header>

      <List>
        <Section header="Режим игры">
          <Cell subtitle="Диалог с одним персонажем" onClick={() => navigate(ROUTES.chat)}>
            Один на один
          </Cell>
          {/* Групповой режим и настройки появятся следующими шагами. */}
          <Cell subtitle="Скоро">Группа персонажей</Cell>
        </Section>

        <Section header="Библиотека">
          <Cell subtitle="Ваши персонажи" onClick={() => navigate(ROUTES.characters)}>
            Персонажи
          </Cell>
        </Section>
      </List>
    </div>
  );
}
