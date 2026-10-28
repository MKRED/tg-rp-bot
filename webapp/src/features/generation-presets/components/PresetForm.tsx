import { Button, Stack } from "@mantine/core";
import { useState } from "react";
import { DeleteButton } from "../../../shared/components/DeleteButton";
import { BasicsSection } from "./BasicsSection";
import { SAMPLING_SPECS, type SamplingKey, type SamplingState } from "../lib/param-specs";
import { ModelResponseSection } from "./ModelResponseSection";
import { DEFAULT_DEEPSEEK_MODEL, type PresetInput, type ReasoningEffort } from "../types/preset";

interface PresetFormProps {
  /** Начальные значения (режим редактирования); отсутствуют — режим создания. */
  initial?: PresetInput;
  submitting: boolean;
  onSubmit: (input: PresetInput) => void;
  /** Удаление доступно только при редактировании. */
  onDelete?: () => void;
}

const DEFAULT_EFFORT: ReasoningEffort = "high";

/** Начальное состояние сэмплинга: значение из пресета (тумблер вкл) либо дефолт спеки (выкл). */
function initSampling(initial?: PresetInput): SamplingState {
  const state = {} as SamplingState;
  for (const spec of Object.values(SAMPLING_SPECS)) {
    const v = initial ? initial[spec.key] : null;
    state[spec.key] =
      v == null ? { value: spec.default, enabled: false } : { value: v, enabled: true };
  }
  return state;
}

/** Значение NumberInput → целое ≥ 1 или null (пусто/некорректно). Сервер валидирует повторно. */
function toPositiveInt(value: string | number): number | null {
  const n = typeof value === "number" ? value : Number(value.replace(/\s/g, ""));
  return value !== "" && Number.isInteger(n) && n >= 1 ? n : null;
}

/** Форма создания/редактирования пресета генерации. Состояние держим локально (паттерн CharacterForm). */
export function PresetForm({ initial, submitting, onSubmit, onDelete }: PresetFormProps) {
  const [name, setName] = useState(initial?.name ?? "");
  // null в пресете = модель по умолчанию сервера; в форме показываем её явно и сохраняем выбранную.
  const [model, setModel] = useState(initial?.model ?? DEFAULT_DEEPSEEK_MODEL);
  const [contextUnlimited, setContextUnlimited] = useState(initial?.contextUnlimited ?? false);
  const [contextSize, setContextSize] = useState<string | number>(initial?.contextSize ?? "");
  const [maxTokens, setMaxTokens] = useState<string | number>(initial?.maxTokens ?? "");
  const [streaming, setStreaming] = useState(initial?.streaming ?? false);
  const [sampling, setSampling] = useState<SamplingState>(() => initSampling(initial));
  const [requestReasoning, setRequestReasoning] = useState(initial?.requestReasoning ?? false);
  const [reasoningEffort, setReasoningEffort] = useState<ReasoningEffort>(
    initial?.reasoningEffort ?? DEFAULT_EFFORT,
  );

  const canSubmit = name.trim().length > 0 && !submitting;

  const updateSampling = (key: SamplingKey, value: number, enabled: boolean) => {
    setSampling((prev) => ({ ...prev, [key]: { value, enabled } }));
  };

  const handleSubmit = () => {
    if (!canSubmit) return;

    // Сэмплинг: выключенный тумблер → null (параметр не уйдёт в запрос).
    const samplingPayload = {} as Pick<PresetInput, SamplingKey>;
    for (const spec of Object.values(SAMPLING_SPECS)) {
      const field = sampling[spec.key];
      samplingPayload[spec.key] = field.enabled ? field.value : null;
    }

    onSubmit({
      name: name.trim(),
      model,
      contextUnlimited,
      // при «неограниченном» размер контекста не нужен
      contextSize: contextUnlimited ? null : toPositiveInt(contextSize),
      maxTokens: toPositiveInt(maxTokens),
      streaming,
      ...samplingPayload,
      requestReasoning,
      reasoningEffort: requestReasoning ? reasoningEffort : null,
    });
  };

  return (
    <Stack gap="lg">
      <BasicsSection
        name={name}
        contextUnlimited={contextUnlimited}
        contextSize={contextSize}
        maxTokens={maxTokens}
        streaming={streaming}
        onName={setName}
        onContextUnlimited={setContextUnlimited}
        onContextSize={setContextSize}
        onMaxTokens={setMaxTokens}
        onStreaming={setStreaming}
      />
      <ModelResponseSection
        model={model}
        requestReasoning={requestReasoning}
        reasoningEffort={reasoningEffort}
        sampling={sampling}
        onModel={setModel}
        onRequestReasoning={setRequestReasoning}
        onReasoningEffort={setReasoningEffort}
        onSampling={updateSampling}
      />

      <Stack gap="sm">
        <Button fullWidth disabled={!canSubmit} loading={submitting} onClick={handleSubmit}>
          {initial ? "Сохранить" : "Создать пресет"}
        </Button>
        {onDelete && (
          <DeleteButton disabled={submitting} onClick={onDelete}>
            Удалить пресет
          </DeleteButton>
        )}
      </Stack>
    </Stack>
  );
}
