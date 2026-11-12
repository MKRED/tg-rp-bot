import { SettingsCard } from "../../../../shared/components/SettingsCard";
import { StepperField } from "../../../../shared/components/StepperField";
import { COAUTHOR_LIMITS, type CoauthorChatInput } from "../../types/coauthor";

interface TurnLimitsCardProps {
  value: CoauthorChatInput;
  onChange: (patch: Partial<CoauthorChatInput>) => void;
}

/**
 * Лимиты хода ИИ — отдельной карточкой под «ИИ»: это редкая настройка «на всякий случай», в основной
 * карточке она бы мешала. Тот же степпер, что на экране отладки. Вопросы скрыты при выключенных
 * уточняющих вопросах — лимит тогда ни на что не влияет. Лимит веб-поиска здесь не дублируем: он в
 * общих настройках поиска.
 */
export function TurnLimitsCard({ value, onChange }: TurnLimitsCardProps) {
  const { edits, questions, rounds } = COAUTHOR_LIMITS;
  return (
    <SettingsCard
      title="Лимиты хода"
      description="Сколько ИИ может сделать в ответ на одно сообщение. Не хватило — ИИ скажет, что осталось, и продолжит по вашей просьбе."
    >
      <StepperField
        label="Правок за сообщение"
        description="Каждый изменённый блок — одна правка"
        value={value.maxEdits}
        min={edits.min}
        max={edits.max}
        onCommit={(maxEdits) => onChange({ maxEdits })}
      />
      {value.useAskUser && (
        <StepperField
          label="Вопросов за сообщение"
          description="Сколько раз ИИ может остановиться и спросить вас"
          value={value.maxQuestions}
          min={questions.min}
          max={questions.max}
          onCommit={(maxQuestions) => onChange({ maxQuestions })}
        />
      )}
      <StepperField
        label="Шагов ИИ"
        description="Вызовов модели за один заход: больше — ИИ успеет больше, но ответ дольше и дороже"
        value={value.maxRounds}
        min={rounds.min}
        max={rounds.max}
        onCommit={(maxRounds) => onChange({ maxRounds })}
      />
    </SettingsCard>
  );
}
