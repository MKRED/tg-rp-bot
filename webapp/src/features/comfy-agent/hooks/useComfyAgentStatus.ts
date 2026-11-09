import { useEffect, useState } from "react";
import { getComfyAgentStatus } from "../api/comfy-agent-api";
import type { ComfyAgentStatus } from "../types/comfyAgent";

const POLL_MS = 10_000;

/**
 * Статус агента для экранов, которым нужен ComfyUI (холст): опрос, пока экран открыт и виден.
 * null — ещё не загрузился (не показываем предупреждение раньше времени).
 */
export function useComfyAgentStatus(): ComfyAgentStatus | null {
  const [status, setStatus] = useState<ComfyAgentStatus | null>(null);

  useEffect(() => {
    let alive = true;
    const load = () =>
      getComfyAgentStatus()
        .then((s) => alive && setStatus(s))
        .catch((err) => console.warn("Failed to load ComfyUI agent status", err));
    void load();
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, POLL_MS);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, []);

  return status;
}
