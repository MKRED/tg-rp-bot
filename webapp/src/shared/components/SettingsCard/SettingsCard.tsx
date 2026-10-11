import { Paper, Stack, Text, Title } from "@mantine/core";
import type { ReactNode } from "react";

interface SettingsCardProps {
  title: string;
  /** Пояснение под заголовком — что настраивается в карточке. */
  description?: ReactNode;
  children: ReactNode;
}

/** Карточка группы настроек: заголовок, пояснение и поля столбиком. */
export function SettingsCard({ title, description, children }: SettingsCardProps) {
  return (
    <Paper withBorder p="md">
      <Stack gap="md">
        <div>
          <Title order={4}>{title}</Title>
          {description && (
            <Text size="sm" c="dimmed" mt={4}>
              {description}
            </Text>
          )}
        </div>
        {children}
      </Stack>
    </Paper>
  );
}
