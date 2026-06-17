import { Button } from "@telegram-apps/telegram-ui";
import { useState } from "react";
import { BasicsSection } from "./BasicsSection";
import { CollapsibleSection } from "./CollapsibleSection";
import {
  SAMPLING_SPECS,
  type SamplingKey,
  type SamplingState,
} from "../lib/param-specs";
import { PromptOrderEditor } from "./PromptOrderEditor";
import { PromptsSection } from "./PromptsSection";
import { ReasoningSection } from "./ReasoningSection";
import { SamplingSection } from "./SamplingSection";
import {
  DEFAULT_PROMPT_ORDER,
  type PresetInput,
  type PromptOrderItem,
  type ReasoningEffort,
} from "../types/preset";

interface PresetFormProps {
  /** Начальные значения (режим редактирования); отсутствуют — режим создания. */
  initial?: PresetInput;
  submitting: boolean;
  onSubmit: (input: PresetInput) => void;
  /** Удаление доступно только при редактировании. */
  onDelete?: () => void;
}

const DEFAULT_EFFORT: ReasoningEffort = "medium";

/** Начальное состояние сэмплинга: значение из пресета (тумблер вкл) либо дефолт спеки (выкл). */
function initSampling(initial?: PresetInput): SamplingState {
  const state = {} as SamplingState;
  for (const spec of SAMPLING_SPECS) {
    const v = initial ? initial[spec.key] : null;
    state[spec.key] =
      v == null ? { value: spec.default, enabled: false } : { value: v, enabled: true };
  }
  return state;
}

/** Число из строки поля: пусто/некорректно → null (целое ≥ 1). Сервер валидирует повторно. */
function parseIntField(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const n = Number(trimmed);
  return Number.isInteger(n) && n >= 1 ? n : null;
}

/** Форма создания/редактирования пресета. Состояние держим локально (паттерн CharacterForm). */
export function PresetForm({ initial, submitting, onSubmit, onDelete }: PresetFormProps) {
  const [name, setName] = useState(initial?.name ?? "");
  const [contextUnlimited, setContextUnlimited] = useState(initial?.contextUnlimited ?? false);
  const [contextSize, setContextSize] = useState(
    initial?.contextSize != null ? String(initial.contextSize) : "",
  );
  const [maxTokens, setMaxTokens] = useState(
    initial?.maxTokens != null ? String(initial.maxTokens) : "",
  );
  const [streaming, setStreaming] = useState(initial?.streaming ?? false);
  const [sampling, setSampling] = useState<SamplingState>(() => initSampling(initial));
  const [systemPrompt, setSystemPrompt] = useState(initial?.systemPrompt ?? "");
  const [auxiliarySystemPrompt, setAuxiliarySystemPrompt] = useState(
    initial?.auxiliarySystemPrompt ?? "",
  );
  const [postHistoryInstruction, setPostHistoryInstruction] = useState(
    initial?.postHistoryInstruction ?? "",
  );
  const [userPersonaPrompt, setUserPersonaPrompt] = useState(initial?.userPersonaPrompt ?? "");
  const [userPersonaStreaming, setUserPersonaStreaming] = useState(
    initial?.userPersonaStreaming ?? true,
  );
  const [translationSystemPrompt, setTranslationSystemPrompt] = useState(
    initial?.translationSystemPrompt ?? "",
  );
  const [requestReasoning, setRequestReasoning] = useState(initial?.requestReasoning ?? false);
  const [reasoningEffort, setReasoningEffort] = useState<ReasoningEffort>(
    initial?.reasoningEffort ?? DEFAULT_EFFORT,
  );
  const [promptOrder, setPromptOrder] = useState<PromptOrderItem[]>(
    initial?.promptOrder ?? DEFAULT_PROMPT_ORDER,
  );

  const canSubmit = name.trim().length > 0 && !submitting;

  const updateSampling = (key: SamplingKey, value: number, enabled: boolean) => {
    setSampling((prev) => ({ ...prev, [key]: { value, enabled } }));
  };

  const updatePrompt = (
    field:
      | "systemPrompt"
      | "auxiliarySystemPrompt"
      | "postHistoryInstruction"
      | "userPersonaPrompt"
      | "translationSystemPrompt",
    value: string,
  ) => {
    const setters = {
      systemPrompt: setSystemPrompt,
      auxiliarySystemPrompt: setAuxiliarySystemPrompt,
      postHistoryInstruction: setPostHistoryInstruction,
      userPersonaPrompt: setUserPersonaPrompt,
      translationSystemPrompt: setTranslationSystemPrompt,
    };
    setters[field](value);
  };

  const handleSubmit = () => {
    if (!canSubmit) return;

    // Сэмплинг: выключенный тумблер → null (параметр не уйдёт в запрос).
    const samplingPayload = {} as Pick<PresetInput, SamplingKey>;
    for (const spec of SAMPLING_SPECS) {
      const field = sampling[spec.key];
      samplingPayload[spec.key] = field.enabled ? field.value : null;
    }

    onSubmit({
      name: name.trim(),
      contextUnlimited,
      // при «неограниченном» размер контекста не нужен
      contextSize: contextUnlimited ? null : parseIntField(contextSize),
      maxTokens: parseIntField(maxTokens),
      streaming,
      ...samplingPayload,
      systemPrompt,
      auxiliarySystemPrompt,
      postHistoryInstruction,
      userPersonaPrompt,
      userPersonaStreaming,
      translationSystemPrompt,
      requestReasoning,
      reasoningEffort: requestReasoning ? reasoningEffort : null,
      promptOrder,
    });
  };

  return (
    <div className="preset-form">
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

      <CollapsibleSection title="Параметры сэмплинга">
        <SamplingSection state={sampling} onChange={updateSampling} />
      </CollapsibleSection>

      <PromptsSection
        systemPrompt={systemPrompt}
        auxiliarySystemPrompt={auxiliarySystemPrompt}
        postHistoryInstruction={postHistoryInstruction}
        userPersonaPrompt={userPersonaPrompt}
        userPersonaStreaming={userPersonaStreaming}
        translationSystemPrompt={translationSystemPrompt}
        onChange={updatePrompt}
        onToggleStreaming={setUserPersonaStreaming}
      />

      <div className="preset-form__section-title">Рассуждение</div>
      <ReasoningSection
        requestReasoning={requestReasoning}
        reasoningEffort={reasoningEffort}
        onRequestReasoning={setRequestReasoning}
        onReasoningEffort={setReasoningEffort}
      />

      <div className="preset-form__section-title">Порядок промптов</div>
      <PromptOrderEditor order={promptOrder} onChange={setPromptOrder} />

      <div className="preset-form__actions">
        <Button size="l" stretched disabled={!canSubmit} onClick={handleSubmit}>
          {submitting ? "Сохранение…" : "Сохранить"}
        </Button>
        {onDelete && (
          <Button size="l" stretched mode="outline" disabled={submitting} onClick={onDelete}>
            Удалить пресет
          </Button>
        )}
      </div>
    </div>
  );
}
