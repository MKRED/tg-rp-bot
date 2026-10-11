import { Group, Text } from "@mantine/core";

interface InfoRowProps {
  label: string;
  value: string;
  /** Пояснение мелким текстом под строкой. */
  hint?: string;
}

/** Строка «название — значение» только для чтения (баланс, квота) с необязательным пояснением. */
export function InfoRow({ label, value, hint }: InfoRowProps) {
  return (
    <div>
      <Group justify="space-between" gap="xs" wrap="nowrap">
        <Text size="sm" fw={500}>
          {label}
        </Text>
        <Text size="sm" c="dimmed" ta="right">
          {value}
        </Text>
      </Group>
      {hint && (
        <Text size="xs" c="dimmed" mt={2}>
          {hint}
        </Text>
      )}
    </div>
  );
}
