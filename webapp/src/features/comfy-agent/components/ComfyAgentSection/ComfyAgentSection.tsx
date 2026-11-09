import { Badge, Button, Group, Loader, Text } from "@mantine/core";
import { AnimatePresence, motion } from "framer-motion";
import type { ReactNode } from "react";
import { SettingsCard } from "../../../../shared/components/SettingsCard";
import { confirmAction } from "../../../../shared/telegram/confirm";
import { MOTION_TRANSITION } from "../../../../shared/theme/motion";
import type { useComfyAgent } from "../../hooks/useComfyAgent";
import { InstallSteps } from "./InstallSteps";
import { ReadinessReport } from "./ReadinessReport";

type ComfyAgentSectionProps = Omit<ReturnType<typeof useComfyAgent>, "loading">;

const SHORTCUT = "«Агент ComfyUI (tg-rp-bot)»";

/**
 * Карточка «ComfyUI»: подключение своего ComfyUI через агента на ПК. Браузер к ComfyUI не ходит
 * (страница по HTTPS, ComfyUI по HTTP — Mixed Content), поэтому агент сам подключается к серверу.
 * Состояния: не подключён → команда установки → агент в сети → отчёт о нодах и моделях.
 *
 * Состояние (useComfyAgent) поднято в SettingsPage — экран показывает один лоадер, пока не загрузится всё.
 */
export function ComfyAgentSection(props: ComfyAgentSectionProps) {
  const { status, install, creatingCode, requestInstallCommand, cancelInstall, disconnecting, disconnect } = props;

  const handleDisconnect = async () => {
    const confirmed = await confirmAction(
      "Агент на ПК остановится, и редактирование картинок перестанет работать. Чтобы подключить снова, понадобится новая команда установки.",
      { title: "Отключить ПК?", confirmText: "Отключить" },
    );
    if (confirmed) void disconnect();
  };

  const disconnectButton = (
    <Button variant="subtle" color="red" size="xs" loading={disconnecting} onClick={() => void handleDisconnect()}>
      Отключить ПК
    </Button>
  );

  let body: ReactNode;
  if (install) {
    body = <InstallSteps install={install} onRenew={() => void requestInstallCommand()} renewing={creatingCode} onClose={cancelInstall} />;
  } else if (!status.hasToken) {
    body = (
      <Button fullWidth loading={creatingCode} onClick={() => void requestInstallCommand()}>
        Подключить ПК
      </Button>
    );
  } else if (!status.online) {
    body = (
      <>
        <Text size="sm">Агент не в сети. Запустите на ПК с ComfyUI ярлык {SHORTCUT} на рабочем столе.</Text>
        <Group gap="xs">
          <Button variant="light" size="xs" loading={creatingCode} onClick={() => void requestInstallCommand()}>
            Установить заново
          </Button>
          {disconnectButton}
        </Group>
      </>
    );
  } else {
    body = <OnlineBody {...props} disconnectButton={disconnectButton} />;
  }

  return (
    <SettingsCard
      title="ComfyUI"
      description="Свой ComfyUI на компьютере — на нём работает редактирование картинок. Приложение связывается с ним через небольшой агент, который запускается на том же компьютере: открывать порты и настраивать адреса не нужно."
    >
      <Group justify="space-between" wrap="nowrap">
        <Text size="sm" fw={500}>
          Агент на ПК
        </Text>
        <StatusBadge hasToken={status.hasToken} online={status.online} />
      </Group>
      {/* Смена состояния (команда → в сети → отчёт) — плавно, а не скачком высоты карточки. */}
      <AnimatePresence initial={false} mode="wait">
        <motion.div
          key={install ? "install" : status.online ? "online" : status.hasToken ? "offline" : "none"}
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          transition={MOTION_TRANSITION}
          style={{ overflow: "hidden", display: "flex", flexDirection: "column", gap: "var(--mantine-spacing-sm)" }}
        >
          {body}
        </motion.div>
      </AnimatePresence>
    </SettingsCard>
  );
}

function StatusBadge({ hasToken, online }: { hasToken: boolean; online: boolean }) {
  if (online) return <Badge color="green" variant="light">В сети</Badge>;
  return (
    <Badge color="gray" variant="light">
      {hasToken ? "Не в сети" : "Не подключён"}
    </Badge>
  );
}

function OnlineBody({
  readiness,
  checking,
  checkError,
  runCheck,
  disconnectButton,
}: ComfyAgentSectionProps & { disconnectButton: ReactNode }) {
  return (
    <>
      {checking && !readiness ? (
        <Group gap="xs">
          <Loader size="xs" />
          <Text size="sm" c="dimmed">
            Проверяю ComfyUI…
          </Text>
        </Group>
      ) : checkError ? (
        <Text size="sm" c="red">
          {checkError}
        </Text>
      ) : (
        readiness && <ReadinessReport readiness={readiness} />
      )}
      <Group gap="xs">
        <Button variant="light" size="xs" loading={checking} onClick={() => void runCheck()}>
          Проверить снова
        </Button>
        {disconnectButton}
      </Group>
    </>
  );
}
