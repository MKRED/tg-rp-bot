import { useCallback, useEffect, useRef, useState } from "react";
import { useToast } from "../../../shared/toast";
import { checkComfy, createInstallCode, disconnectComfyAgent, getComfyAgentStatus } from "../api/comfy-agent-api";
import { buildInstallCommand } from "../lib/installCommand";
import type { ComfyAgentStatus, ComfyReadiness } from "../types/comfyAgent";

/** Как часто спрашивать статус, пока экран открыт: «В сети» должно появиться без перезагрузки. */
const STATUS_POLL_MS = 4000;

export interface InstallCommand {
  command: string;
  expiresAt: number;
}

/**
 * Состояние карточки ComfyUI: статус агента (опрашивается, пока экран открыт и виден), команда
 * установки (показывается только сразу после выдачи кода — сервер её больше не вернёт) и проверка
 * ComfyUI, которая запускается сама, когда агент выходит в сеть.
 */
export function useComfyAgent() {
  const [status, setStatus] = useState<ComfyAgentStatus>({ hasToken: false, online: false, lastSeenAt: null });
  const [loading, setLoading] = useState(true);
  const [install, setInstall] = useState<InstallCommand | null>(null);
  const [creatingCode, setCreatingCode] = useState(false);
  const [readiness, setReadiness] = useState<ComfyReadiness | null>(null);
  const [checking, setChecking] = useState(false);
  const [checkError, setCheckError] = useState<string | null>(null);
  const [disconnecting, setDisconnecting] = useState(false);
  const { showToast } = useToast();

  const refreshStatus = useCallback(
    () =>
      getComfyAgentStatus()
        .then(setStatus)
        .catch((err) => console.error("Failed to load ComfyUI agent status", err)),
    [],
  );

  useEffect(() => {
    void refreshStatus().finally(() => setLoading(false));
    // Во фоне не опрашиваем: вкладка или Mini App свёрнуты — статус никто не смотрит.
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") void refreshStatus();
    }, STATUS_POLL_MS);
    return () => clearInterval(timer);
  }, [refreshStatus]);

  // checkRequestRef — поколение проверки: ответ, пришедший после отключения ПК, не должен вернуть
  // на экран отчёт о ComfyUI, которого уже нет.
  const checkRequestRef = useRef(0);
  const runCheck = useCallback(async () => {
    const requestId = ++checkRequestRef.current;
    setChecking(true);
    setCheckError(null);
    try {
      const result = await checkComfy();
      if (checkRequestRef.current === requestId) setReadiness(result);
    } catch (err) {
      console.error("ComfyUI check failed", err);
      if (checkRequestRef.current === requestId) {
        setReadiness(null);
        setCheckError(err instanceof Error ? err.message : "Не удалось проверить ComfyUI.");
      }
    } finally {
      if (checkRequestRef.current === requestId) setChecking(false);
    }
  }, []);

  // Агент вышел в сеть — команда установки отработала (прячем её) и пора проверить ComfyUI.
  // Ушёл из сети — прежний отчёт уже ничего не говорит о текущем состоянии.
  useEffect(() => {
    if (status.online) {
      setInstall(null);
      void runCheck();
    } else {
      checkRequestRef.current++;
      setReadiness(null);
      setCheckError(null);
      setChecking(false);
    }
  }, [status.online, runCheck]);

  const requestInstallCommand = useCallback(async () => {
    setCreatingCode(true);
    try {
      const { code, expiresAt } = await createInstallCode();
      setInstall({ command: buildInstallCommand(window.location.origin, code), expiresAt: Date.parse(expiresAt) });
    } catch (err) {
      console.error("Failed to create ComfyUI agent install code", err);
      showToast({ type: "error", message: "Не удалось получить команду установки. Попробуйте ещё раз." });
    } finally {
      setCreatingCode(false);
    }
  }, [showToast]);

  const disconnect = useCallback(async () => {
    setDisconnecting(true);
    try {
      await disconnectComfyAgent();
      setInstall(null);
      await refreshStatus();
    } catch (err) {
      console.error("Failed to disconnect ComfyUI agent", err);
      showToast({ type: "error", message: "Не удалось отключить ПК." });
    } finally {
      setDisconnecting(false);
    }
  }, [refreshStatus, showToast]);

  return {
    status,
    loading,
    install,
    creatingCode,
    requestInstallCommand,
    cancelInstall: () => setInstall(null),
    readiness,
    checking,
    checkError,
    runCheck,
    disconnecting,
    disconnect,
  };
}
