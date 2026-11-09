import { Stack, Text } from "@mantine/core";
import { CircleCheck, CircleX } from "lucide-react";
import { InfoRow } from "../../../../shared/components/InfoRow";
import { formatGigabytes } from "../../lib/installCommand";
import type { ComfyModelReadiness, ComfyReadiness } from "../../types/comfyAgent";
import classes from "./ComfyAgentSection.module.css";

/** Отчёт проверки ComfyUI: версия, видеокарта и что нужно доставить для каждой модели. */
export function ReadinessReport({ readiness }: { readiness: ComfyReadiness }) {
  const { gpu } = readiness;
  return (
    <Stack gap="sm">
      <InfoRow label="ComfyUI" value={readiness.comfyuiVersion ?? "версия неизвестна"} />
      <InfoRow
        label="Видеокарта"
        value={gpu ? `${gpu.name}, ${formatGigabytes(gpu.vramTotalBytes)}` : "не найдена"}
        hint={gpu ? undefined : "ComfyUI не сообщил о видеокарте — на процессоре генерация будет очень долгой."}
      />
      {readiness.models.map((model) => (
        <ModelRow key={model.id} model={model} />
      ))}
    </Stack>
  );
}

function ModelRow({ model }: { model: ComfyModelReadiness }) {
  const Icon = model.ready ? CircleCheck : CircleX;
  return (
    <div className={classes.modelRow}>
      <Icon size={18} className={`${classes.modelIcon} ${model.ready ? classes.ready : classes.notReady}`} />
      <div>
        <Text size="sm" fw={500}>
          {model.label}
        </Text>
        <Text size="xs" c="dimmed">
          {model.ready ? "Готова к работе" : "Не хватает:"}
        </Text>
        {!model.ready && (
          <ul className={classes.missing}>
            {model.missingNodes.map((node) => (
              <li key={node}>нода {node} — обновите ComfyUI</li>
            ))}
            {model.missingFiles.map((f) => (
              <li key={f.file}>
                файл models/{f.folder}/{f.file}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
