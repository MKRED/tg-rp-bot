import { Accordion, Button, Group, Loader, Paper, Stack, Switch, Text, Title } from "@mantine/core";
import { RefreshCw, Trash2 } from "lucide-react";
import { SettingsCard } from "../../../shared/components/SettingsCard";
import { StepperField } from "../../../shared/components/StepperField";
import { useDebugLlm } from "../hooks/useDebugLlm";
import { DebugRecordItem } from "./DebugRecordItem";
import styles from "./DebugLlmView.module.css";

/**
 * Экран отладки LLM: перехваченные RAW-запросы текущего пользователя + управление перехватом
 * (тумблер «писать лог», N последних запросов) и показом (сколько сообщений с краёв).
 */
export function DebugLlmView() {
  const { settings, records, loading, refresh, updateSettings, clear } = useDebugLlm();

  return (
    <>
      <SettingsCard title="Перехват" description="Лог хранится в памяти сервера и сбрасывается при перезапуске.">
        <Switch
          label="Писать лог"
          description="Записывать запросы к ИИ"
          checked={settings.enabled}
          onChange={(e) => void updateSettings({ enabled: e.currentTarget.checked })}
        />
        <StepperField
          label="Хранить запросов"
          description="Сколько последних держать"
          value={settings.maxRequests}
          min={1}
          onCommit={(n) => void updateSettings({ maxRequests: n })}
        />
      </SettingsCard>

      <SettingsCard
        title="Показ"
        description="Усечение длинного messages[] — только на показе, на сам запрос не влияет. Хранится на сервере, одинаково на всех устройствах."
      >
        <StepperField
          label="Сообщений с начала"
          value={settings.headMessages}
          min={0}
          onCommit={(n) => void updateSettings({ headMessages: n })}
        />
        <StepperField
          label="Сообщений с конца"
          value={settings.tailMessages}
          min={0}
          onCommit={(n) => void updateSettings({ tailMessages: n })}
        />
      </SettingsCard>

      <Paper className={styles.records}>
        <Stack gap="sm" p="md">
          <Title order={4}>Запросы ({records.length})</Title>
          <Group gap="xs">
            <Button variant="light" leftSection={<RefreshCw size={16} />} onClick={() => void refresh()}>
              Обновить
            </Button>
            <Button
              variant="subtle"
              color="red"
              leftSection={<Trash2 size={16} />}
              disabled={records.length === 0}
              onClick={() => void clear()}
            >
              Очистить
            </Button>
          </Group>
        </Stack>

        {loading ? (
          <Group justify="center" p="md">
            <Loader size="sm" />
          </Group>
        ) : records.length === 0 ? (
          <Text c="dimmed" ta="center" p="md">
            Пока нет запросов
          </Text>
        ) : (
          // multiple — записи раскрываются независимо, как раньше.
          <Accordion multiple classNames={{ item: styles.item, control: styles.control }}>
            {records.map((rec) => (
              <DebugRecordItem key={rec.id} record={rec} headK={settings.headMessages} tailK={settings.tailMessages} />
            ))}
          </Accordion>
        )}
      </Paper>
    </>
  );
}
