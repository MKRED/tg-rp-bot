import { Cell, Switch } from "@telegram-apps/telegram-ui";
import { DEFAULT_IMPERSONATE_TEMPLATE } from "../lib/impersonateTemplate";
import { PromptField } from "./PromptField";

interface PromptsSectionProps {
  systemPrompt: string;
  auxiliarySystemPrompt: string;
  postHistoryInstruction: string;
  userPersonaPrompt: string;
  userPersonaStreaming: boolean;
  translationSystemPrompt: string;
  onChange: (
    field:
      | "systemPrompt"
      | "auxiliarySystemPrompt"
      | "postHistoryInstruction"
      | "userPersonaPrompt"
      | "translationSystemPrompt",
    value: string,
  ) => void;
  onToggleStreaming: (value: boolean) => void;
}

/** Секция промптов: основной/вспомогательный/после истории + служебные (от лица пользователя, перевод). */
export function PromptsSection({
  systemPrompt,
  auxiliarySystemPrompt,
  postHistoryInstruction,
  userPersonaPrompt,
  userPersonaStreaming,
  translationSystemPrompt,
  onChange,
  onToggleStreaming,
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
        hint="Шаблон системной инструкции. Плейсхолдеры: {{char}}, {{user}}, {{char_prompt}}, {{user_prompt}}, {{system_prompt}}, {{aux_prompt}}. История чата добавляется отдельным сообщением. Пусто → используется шаблон по умолчанию."
        value={userPersonaPrompt}
        rows={8}
        placeholder={DEFAULT_IMPERSONATE_TEMPLATE}
        onChange={(v) => onChange("userPersonaPrompt", v)}
      />
      <Cell
        after={
          <Switch
            checked={userPersonaStreaming}
            onChange={(e) => onToggleStreaming(e.target.checked)}
          />
        }
        subtitle="Показывать текст по мере генерации варианта"
      >
        Стримить ответ от лица пользователя
      </Cell>

      <PromptField
        label="Промпт для перевода (ИИ-режим)"
        hint="Системная инструкция для перевода черновика сообщения через нейросеть. Плейсхолдер {{target_lang}} — полное английское название выбранного языка. Текст сообщения уходит ролью user. Пусто → используется шаблон по умолчанию."
        value={translationSystemPrompt}
        rows={6}
        onChange={(v) => onChange("translationSystemPrompt", v)}
      />
    </>
  );
}
