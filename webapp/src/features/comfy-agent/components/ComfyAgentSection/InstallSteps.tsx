import { ActionIcon, Button, Group, Stack, Text, Tooltip } from "@mantine/core";
import { Check, Copy } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { InstallCommand } from "../../hooks/useComfyAgent";
import classes from "./ComfyAgentSection.module.css";

const COPIED_MS = 2000;

interface InstallStepsProps {
  install: InstallCommand;
  /** Новая команда вместо истёкшей. */
  onRenew: () => void;
  renewing: boolean;
  onClose: () => void;
}

/**
 * Шаги установки агента с командой для PowerShell. Команду показываем только здесь: сервер выдаёт
 * код один раз. Пока команда на экране, статус выше опрашивается — «В сети» появится сам.
 */
export function InstallSteps({ install, onRenew, renewing, onClose }: InstallStepsProps) {
  const [copied, setCopied] = useState(false);
  const copiedTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 10_000);
    return () => {
      clearInterval(timer);
      clearTimeout(copiedTimer.current);
    };
  }, []);

  const expired = now >= install.expiresAt;

  const copy = () => {
    navigator.clipboard
      .writeText(install.command)
      .then(() => {
        setCopied(true);
        clearTimeout(copiedTimer.current);
        copiedTimer.current = setTimeout(() => setCopied(false), COPIED_MS);
      })
      .catch((err) => console.error("Failed to copy install command", err));
  };

  return (
    <Stack gap="sm">
      <ol className={classes.steps}>
        <li>На ПК с ComfyUI откройте PowerShell (Win+X → «Терминал» или «Windows PowerShell»).</li>
        <li>Вставьте команду и нажмите Enter:</li>
      </ol>

      {expired ? (
        <Group justify="space-between" wrap="nowrap">
          <Text size="sm" c="dimmed">
            Команда устарела.
          </Text>
          <Button variant="light" size="xs" loading={renewing} onClick={onRenew}>
            Новая команда
          </Button>
        </Group>
      ) : (
        <div className={classes.command}>
          {install.command}
          <Tooltip label={copied ? "Скопировано" : "Скопировать"} withinPortal>
            <ActionIcon
              className={classes.copyButton}
              variant="subtle"
              onClick={copy}
              aria-label="Скопировать команду"
            >
              {copied ? <Check size={16} /> : <Copy size={16} />}
            </ActionIcon>
          </Tooltip>
        </div>
      )}

      <Text size="xs" c="dimmed">
        Команда одноразовая и действует 15 минут. Агент запустится в отдельном окне, а на рабочем столе
        появится ярлык «Агент ComfyUI (tg-rp-bot)» — дальше запускайте его. ComfyUI должен работать на этом
        ПК (адрес 127.0.0.1:8188).
      </Text>

      <Button variant="subtle" size="xs" onClick={onClose} style={{ alignSelf: "flex-start" }}>
        Скрыть команду
      </Button>
    </Stack>
  );
}
