import { Button, Text } from "@mantine/core";
import { type LucideIcon, Plus } from "lucide-react";
import type { ReactNode } from "react";
import { AppPage } from "../AppPage";
import { EmptyState } from "../EmptyState";
import { ListCard } from "../ListCard";

interface ListPageProps {
  title: string;
  description: string;
  /** Иконка заглушек (пусто, ошибка). */
  icon: LucideIcon;
  loading: boolean;
  error: boolean;
  /** Сколько элементов в списке: 0 — заглушка «пусто» с кнопкой создания вместо карточки. */
  count: number;
  /** Лимит элементов на пользователя: при достижении создание недоступно. Нет — список без лимита. */
  limit?: number;
  /** Подпись под списком при достижении лимита. */
  limitText?: string;
  /** Подпись кнопки создания на пустом экране («Создать персону»). */
  createLabel: string;
  emptyTitle: string;
  emptyDescription: string;
  onCreate: () => void;
  /** Строки списка — ListRow. */
  children: ReactNode;
  /** Под карточкой списка: маячок догрузки страниц (InfiniteSentinel). */
  footer?: ReactNode;
}

/**
 * Экран-хаб списка сущностей: заголовок с кнопкой «Создать», карточка со строками, заглушки загрузки,
 * ошибки и пустого списка, подпись о лимите.
 */
export function ListPage({
  title,
  description,
  icon,
  loading,
  error,
  count,
  limit,
  limitText,
  createLabel,
  emptyTitle,
  emptyDescription,
  onCreate,
  children,
  footer,
}: ListPageProps) {
  const atLimit = limit !== undefined && count >= limit;

  return (
    <AppPage
      title={title}
      description={description}
      loading={loading}
      actions={
        // В шапке, а не под списком: кнопку видно сразу, даже при длинном списке. На пустом экране
        // её заменяет кнопка в заглушке.
        !error &&
        count > 0 && (
          <Button leftSection={<Plus size={18} />} disabled={atLimit} onClick={onCreate}>
            Создать
          </Button>
        )
      }
    >
      {error ? (
        <EmptyState icon={icon} title="Не удалось загрузить список" description="Проверьте соединение и откройте экран снова." />
      ) : count === 0 ? (
        <EmptyState
          icon={icon}
          title={emptyTitle}
          description={emptyDescription}
          action={
            <Button leftSection={<Plus size={18} />} onClick={onCreate}>
              {createLabel}
            </Button>
          }
        />
      ) : (
        <>
          <ListCard>{children}</ListCard>
          {footer}
          {atLimit && (
            <Text size="sm" c="dimmed" ta="center">
              {limitText}
            </Text>
          )}
        </>
      )}
    </AppPage>
  );
}
