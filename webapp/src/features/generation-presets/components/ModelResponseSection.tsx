import { Box, Collapse, Input, SegmentedControl, Text } from "@mantine/core";
import { SettingsCard } from "../../../shared/components/SettingsCard";
import { useDeepSeekModels } from "../hooks/useDeepSeekModels";
import { samplingHint, samplingRules } from "../lib/model-rules";
import { SAMPLING_SPECS, type SamplingKey, type SamplingState } from "../lib/param-specs";
import { REASONING_EFFORTS, REASONING_EFFORT_LABELS, type ReasoningEffort } from "../types/preset";
import { DeepSeekModelPicker } from "./DeepSeekModelPicker";
import { SamplingSlider } from "./SamplingSlider";

const MODE_OPTIONS = [
  { value: "normal", label: "Обычный" },
  { value: "reasoning", label: "С рассуждением" },
];

const EFFORT_OPTIONS = REASONING_EFFORTS.map((effort) => ({ value: effort, label: REASONING_EFFORT_LABELS[effort] }));

interface ModelResponseSectionProps {
  model: string;
  requestReasoning: boolean;
  reasoningEffort: ReasoningEffort;
  sampling: SamplingState;
  onModel: (value: string) => void;
  onRequestReasoning: (value: boolean) => void;
  onReasoningEffort: (value: ReasoningEffort) => void;
  onSampling: (key: SamplingKey, value: number, enabled: boolean) => void;
}

/**
 * Карточка «Ответ модели»: модель, режим (обычный / с рассуждением), глубина рассуждения и только те
 * параметры сэмплинга, которые DeepSeek применяет в этой связке (model-rules.ts). Скрытые параметры
 * не сбрасываются — значения живут в состоянии формы и вернутся при смене режима или модели.
 */
export function ModelResponseSection(props: ModelResponseSectionProps) {
  const { model, requestReasoning, reasoningEffort, sampling, onSampling } = props;
  const models = useDeepSeekModels();
  const rules = samplingRules(model, requestReasoning);
  const hint = samplingHint(model, requestReasoning);

  const slider = (key: SamplingKey) => {
    const field = sampling[key];
    const spec = { ...SAMPLING_SPECS[key], min: rules[key].min };
    return (
      <Collapse key={key} expanded={rules[key].applies}>
        <Box pb="md">
          <SamplingSlider
            spec={spec}
            // DeepSeek поднимает значения ниже минимума сам — показываем то, что реально уйдёт в работу.
            value={Math.max(field.value, spec.min)}
            enabled={field.enabled}
            onValue={(value) => onSampling(key, value, field.enabled)}
            onEnabled={(enabled) => onSampling(key, field.value, enabled)}
          />
        </Box>
      </Collapse>
    );
  };

  return (
    <SettingsCard
      title="Ответ модели"
      description="Показаны только параметры, которые DeepSeek применяет с выбранной моделью и режимом."
    >
      <DeepSeekModelPicker value={model} onChange={props.onModel} {...models} />
      <Input.Wrapper label="Режим">
        <SegmentedControl
          fullWidth
          mt={4}
          data={MODE_OPTIONS}
          value={requestReasoning ? "reasoning" : "normal"}
          onChange={(v) => props.onRequestReasoning(v === "reasoning")}
        />
      </Input.Wrapper>
      {/* Отступы — внутри раскрываемых блоков: свёрнутый Collapse отдельным ребёнком Stack всё равно
          получил бы gap. Поэтому раскрывашки и пояснение — в одной обёртке. */}
      <div>
        <Collapse expanded={requestReasoning}>
          <Input.Wrapper label="Глубина рассуждения" pb="md">
            <SegmentedControl
              fullWidth
              mt={4}
              data={EFFORT_OPTIONS}
              value={reasoningEffort}
              onChange={(v) => props.onReasoningEffort(v as ReasoningEffort)}
            />
          </Input.Wrapper>
        </Collapse>
        {slider("temperature")}
        {slider("topP")}
        {hint && (
          <Text size="xs" c="dimmed">
            {hint}
          </Text>
        )}
      </div>
    </SettingsCard>
  );
}
