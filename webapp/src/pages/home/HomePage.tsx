import { Avatar, Badge, Stack, Text, Title } from "@mantine/core";
import { useState } from "react";
import { useTransitionNavigate } from "../../app/useTransitionNavigate";
import { useAuth } from "../../features/auth";
import { AppPage } from "../../shared/components/AppPage";
import { ListCard, ListRow } from "../../shared/components/ListCard";
import { getTgUser } from "../../shared/telegram/initData";
import { useProfilePhoto } from "../../shared/telegram/useProfilePhoto";
import { randomGreeting } from "./greetings";
import { HOME_MENU } from "./homeMenu";

/** Номер первой строки каждой группы — сквозная нумерация для поочерёдного появления сверху вниз. */
const SECTION_OFFSETS = HOME_MENU.map((_, i) => HOME_MENU.slice(0, i).reduce((sum, s) => sum + s.items.length, 0));

/** Главная: приветствие с профилем и меню всех экранов приложения. */
export function HomePage() {
  const navigate = useTransitionNavigate();
  const user = getTgUser();
  const { session } = useAuth();
  const photoUrl = useProfilePhoto();
  // Приветствие фиксируется при монтировании — одно на сессию, не мигает при ре-рендерах.
  const [greeting] = useState(() => randomGreeting());

  // В Telegram — профиль из initData; в браузере — из сессии входа по логину.
  const displayName = user?.firstName ?? session?.displayName ?? "Гость";
  const fullName = user?.fullName ?? session?.displayName;
  const handle = user
    ? user.username
      ? `@${user.username}`
      : "Telegram"
    : session?.login
      ? `логин: ${session.login}`
      : "не в Telegram";

  return (
    <AppPage>
      <Stack align="center" gap={4} ta="center" pb="xs">
        {/* name — инициалы на заглушке (цвет — акцент палитры), пока фото грузится или его нет (браузер). */}
        <Avatar src={photoUrl} name={fullName} color="accent" size={88} mb="xs" />
        <Title order={2}>
          {greeting}, {displayName}!
        </Title>
        <Text size="sm" c="dimmed">
          {handle}
        </Text>
      </Stack>

      {HOME_MENU.map((section, sectionIndex) => (
        <ListCard key={section.title} title={section.title}>
          {section.items.map(({ route, icon: Icon, label, description }, itemIndex) => (
            <ListRow
              key={label}
              // Иконка без плашки — в цвете акцента; у неготового пункта — приглушённая.
              leading={<Icon size={24} color={route ? "var(--mantine-primary-color-filled)" : "var(--mantine-color-dimmed)"} aria-hidden />}
              title={label}
              description={description}
              meta={
                route ? undefined : (
                  <Badge variant="light" color="gray">
                    Скоро
                  </Badge>
                )
              }
              disabled={!route}
              index={SECTION_OFFSETS[sectionIndex]! + itemIndex}
              onClick={route ? () => navigate(route) : undefined}
            />
          ))}
        </ListCard>
      ))}
    </AppPage>
  );
}
