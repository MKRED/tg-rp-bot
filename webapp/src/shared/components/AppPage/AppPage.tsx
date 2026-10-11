import { Container, Loader, Stack, Title } from "@mantine/core";
import type { ReactNode } from "react";
import { useTelegramChrome } from "../../telegram/useTelegramChrome";
import { surfaces, useTheme } from "../../theme";
import { PageTransition } from "../PageTransition";
import styles from "./AppPage.module.css";

/** Ширина колонки контента: на телефоне — во всю ширину, на ПК — по центру, не растягиваясь. */
const CONTENT_WIDTH = 680;

interface AppPageProps {
  /** Заголовок экрана над контентом. */
  title?: string;
  /** Пока true — один лоадер на весь экран вместо частичного контента. */
  loading?: boolean;
  children: ReactNode;
}

/**
 * Каркас экрана на Mantine: фон страницы, отступы safe area, колонка ограниченной ширины, анимация
 * появления и цвета шапки Telegram под палитру. Каждый переехавший экран рендерится внутри него.
 */
export function AppPage({ title, loading, children }: AppPageProps) {
  const { appearance } = useTheme();
  useTelegramChrome(surfaces[appearance].page);

  return (
    <div className={styles.page}>
      {/* phase перезапускает анимацию появления, когда лоадер сменяется контентом. */}
      <PageTransition phase={loading ? "loading" : "ready"}>
        <Container size={CONTENT_WIDTH} px="md">
          {loading ? (
            <div className={styles.loading}>
              <Loader />
            </div>
          ) : (
            <Stack gap="lg">
              {title && <Title order={2}>{title}</Title>}
              {children}
            </Stack>
          )}
        </Container>
      </PageTransition>
    </div>
  );
}
