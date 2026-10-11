import { Box, Stack, Text, Title } from "@mantine/core";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: ReactNode;
  /** Кнопка действия под текстом (создать первое, повторить). */
  action?: ReactNode;
}

/** Заглушка вместо контента: пустой список, «не найдено», ошибка загрузки. */
export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <Stack align="center" ta="center" gap="xs" py="xl" px="md">
      {Icon && <Icon size={40} strokeWidth={1.5} color="var(--mantine-color-dimmed)" aria-hidden />}
      <Title order={4}>{title}</Title>
      {description && (
        <Text size="sm" c="dimmed" maw={320}>
          {description}
        </Text>
      )}
      {action && <Box mt="sm">{action}</Box>}
    </Stack>
  );
}
