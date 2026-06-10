import { PromptField } from "./PromptField";

interface PromptsSectionProps {
  systemPrompt: string;
  auxiliarySystemPrompt: string;
  postHistoryInstruction: string;
  userPersonaPrompt: string;
  onChange: (
    field:
      | "systemPrompt"
      | "auxiliarySystemPrompt"
      | "postHistoryInstruction"
      | "userPersonaPrompt",
    value: string,
  ) => void;
}

/** Секция промптов: основной/вспомогательный/после истории + служебный (от лица пользователя). */
export function PromptsSection({
  systemPrompt,
  auxiliarySystemPrompt,
  postHistoryInstruction,
  userPersonaPrompt,
  onChange,
}: PromptsSectionProps) {
  return (
    <>
      <div className="preset-form__section-title">Промпты</div>
      <PromptField
        label="Основной системный промпт"
        hint="Базовые инструкции модели: задаёт роль, стиль и правила ответа."
        value={systemPrompt}
        rows={6}
        onChange={(v) => onChange("systemPrompt", v)}
      />
      <PromptField
        label="Вспомогательный системный промпт"
        hint="Дополнительные указания поверх основного — например, формат или ограничения."
        value={auxiliarySystemPrompt}
        onChange={(v) => onChange("auxiliarySystemPrompt", v)}
      />
      <PromptField
        label="Инструкция после истории"
        hint="Текст, вставляемый после истории чата — последнее напоминание модели перед ответом."
        value={postHistoryInstruction}
        onChange={(v) => onChange("postHistoryInstruction", v)}
      />

      <div className="preset-form__section-title">Служебные промпты</div>
      <PromptField
        label="Промпт для генерации ответа от лица пользователя"
        hint="Используется, когда модель пишет реплику за самого пользователя."
        value={userPersonaPrompt}
        onChange={(v) => onChange("userPersonaPrompt", v)}
      />
    </>
  );
}
