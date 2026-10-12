import { Container, Group, Loader, Stack, Text, Title } from "@mantine/core";
import type { ReactNode } from "react";
import { PageTransition } from "../PageTransition";
import styles from "./AppPage.module.css";

/** Ширина колонки контента: на телефоне — во всю ширину, на ПК — по центру, не растягиваясь. */
const CONTENT_WIDTH = 680;

interface AppPageProps {
  /** Заголовок экрана над контентом. */
  title?: string;
  /** Пояснение под заголовком — что это за экран. */
  description?: string;
  /** Справа от заголовка: главное действие экрана (например, «Создать»). */
  actions?: ReactNode;
  /** Пока true — один лоадер на весь экран вместо частичного контента. */
  loading?: boolean;
  /** Ширина колонки, px — уже стандартной для экранов с одной короткой формой (вход). */
  width?: number;
  /** Контент по центру экрана по вертикали (короткие экраны: вход, ошибка), а не сверху. */
  centered?: boolean;
  children?: ReactNode;
}

/**
 * Каркас экрана: фон страницы, отступы safe area, колонка ограниченной ширины, анимация
 * появления. Каждый экран рендерится внутри него (или FullHeightPage).
 */
export function AppPage({ title, description, actions, loading, width = CONTENT_WIDTH, centered, children }: AppPageProps) {
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
              {title && (
                <Group justify="space-between" align="center" wrap="nowrap" gap="sm">
                  <div className={styles.heading}>
                    <Title order={2}>{title}</Title>
                    {description && (
                      <Text size="sm" c="dimmed">
                        {description}
                      </Text>
                    )}
                  </div>
                  {actions && <div className={styles.actions}>{actions}</div>}
                </Group>
              )}
              {children}
            </Stack>
          )}
        </Container>
      </PageTransition>
    </div>
  );
}
