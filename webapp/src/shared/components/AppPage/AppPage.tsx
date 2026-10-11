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
  /** Ширина колонки, px — уже стандартной для экранов с одной короткой формой (вход). */
  width?: number;
  /** Контент по центру экрана по вертикали (короткие экраны: вход, ошибка), а не сверху. */
  centered?: boolean;
  children?: ReactNode;
}

/**
 * Каркас экрана на Mantine: фон страницы, отступы safe area, колонка ограниченной ширины, анимация
 * появления и цвета шапки Telegram под палитру. Каждый переехавший экран рендерится внутри него.
 */
export function AppPage({ title, loading, width = CONTENT_WIDTH, centered, children }: AppPageProps) {
  const { appearance } = useTheme();
  useTelegramChrome(surfaces[appearance].page);

  return (
    <div className={centered ? `${styles.page} ${styles.centered}` : styles.page}>
      {/* phase перезапускает анимацию появления, когда лоадер сменяется контентом. */}
      <PageTransition phase={loading ? "loading" : "ready"}>
        <Container size={width} px="md">
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
