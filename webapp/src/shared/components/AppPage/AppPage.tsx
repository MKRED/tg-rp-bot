import { Container, Group, Loader, Stack, Text, Title } from "@mantine/core";
import type { ReactNode } from "react";
import { usePageTitle } from "../../hooks/usePageTitle";
import { BackNavButton } from "../BackNavButton";
import { PageTransition } from "../PageTransition";
import styles from "./AppPage.module.css";

/** Ширина колонки контента: на телефоне — во всю ширину, на ПК — по центру, не растягиваясь. */
const CONTENT_WIDTH = 680;

interface AppPageProps {
  /** Заголовок экрана над контентом. */
  title?: string;
  /** Заголовок вкладки браузера, если он точнее title (имя открытой сущности); по умолчанию — title. */
  tabTitle?: string | null;
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
  /** Кнопка «Назад» в браузере (по умолчанию есть); false — экраны вне иерархии (вход, ошибка входа). */
  back?: boolean;
  children?: ReactNode;
}

/**
 * Каркас экрана: фон страницы, отступы safe area, колонка ограниченной ширины, анимация
 * появления. Каждый экран рендерится внутри него (или FullHeightPage).
 */
export function AppPage({ title, tabTitle, description, actions, loading, width = CONTENT_WIDTH, centered, back = true, children }: AppPageProps) {
  usePageTitle(tabTitle ?? title);
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
                    {/* «Назад» в браузере — слева от заголовка, как в шапке Telegram; описание ниже
                        начинается от края колонки. */}
                    <Group gap={4} wrap="nowrap" align="flex-start">
                      {back && <BackNavButton className={styles.back} />}
                      <Title order={2} className={styles.title}>
                        {title}
                      </Title>
                    </Group>
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
