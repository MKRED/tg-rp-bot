import { Button, Group, Loader, Text } from "@mantine/core";
import { Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import type { CanvasState } from "../../hooks/useCanvas";
import type { ImageCanvas } from "../../types/imageCanvas";

/** Секунды с начала генерации — тикают раз в секунду. */
function useElapsed(startedAt: string | null): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!startedAt) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [startedAt]);
  return startedAt ? Math.max(0, Math.round((now - Date.parse(startedAt)) / 1000)) : 0;
}

interface GenerateButtonProps {
  canvas: ImageCanvas;
  actions: CanvasState;
  /** Почему запускать нельзя (пустой промпт, нет картинки, агент не в сети); null — можно. */
  blocker: string | null;
  onStart: () => void;
}

/**
 * Запуск генерации. Пока она идёт, кнопка показывает её ход и рядом — «Остановить»: холст при этом
 * свободен, черновики можно листать и разглядывать. Новый черновик откроется на холсте сам.
 */
export function GenerateButton({ canvas, actions, blocker, onStart }: GenerateButtonProps) {
  const { generation } = canvas;
  const running = generation.status === "running";
  const elapsed = useElapsed(running ? generation.startedAt : null);

  if (!running) {
    return (
      <Button leftSection={<Sparkles size={16} />} disabled={Boolean(blocker)} loading={actions.busy === "generate"} onClick={onStart}>
        Сгенерировать
      </Button>
    );
  }

  return (
    <>
      <Group gap="xs" wrap="nowrap">
        <Button flex={1} disabled leftSection={<Loader size={14} />} aria-live="polite">
          Генерация · {elapsed} с
        </Button>
        <Button variant="default" loading={actions.busy === "cancel"} onClick={() => void actions.cancel()}>
          Остановить
        </Button>
      </Group>
      <Text size="xs" c="dimmed">
        Первая генерация после запуска ComfyUI дольше: загружаются модели
      </Text>
    </>
  );
}
