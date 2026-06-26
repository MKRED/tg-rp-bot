import { Button, Input, Section } from "@telegram-apps/telegram-ui";
import { useState } from "react";
import { PromptField } from "../../../shared/components/PromptField";
import type { NarratorTemplate, NarratorTemplateInput } from "../types/template";

/** Подсказка-плейсхолдер: что писать в нарратор-инструкции (дефолт применяется, если оставить пусто). */
const SYSTEM_PLACEHOLDER =
  "Напр.: Ты рассказчик. Веди сцену, озвучивай всех персонажей, не пиши за пользователя. Заканчивай каждый бит на крючке. (Пусто → применится встроенный дефолт.)";

interface TemplateFormProps {
  initial?: NarratorTemplate;
  submitting: boolean;
  onSubmit: (input: NarratorTemplateInput) => void;
  onDelete?: () => void;
}

/** Форма narrator-шаблона: имя + системная инструкция нарратора + (опц.) post-history. */
export function TemplateForm({ initial, submitting, onSubmit, onDelete }: TemplateFormProps) {
  const [name, setName] = useState(initial?.name ?? "");
  const [systemPrompt, setSystemPrompt] = useState(initial?.systemPrompt ?? "");
  const [postHistory, setPostHistory] = useState(initial?.postHistoryInstruction ?? "");

  const valid = name.trim().length > 0;

  return (
    <Section header="Narrator-шаблон" footer="Сэмплинг (температура и пр.) задаётся не здесь, а в пресете генерации.">
      <Input
        header="Название"
        placeholder="Напр. «Кинематографичный рассказчик»"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <PromptField
        label="Инструкция нарратора"
        hint="Системный промпт для режима «Режиссёр истории»: задаёт роль рассказчика, стиль и правила ведения сцены. Пусто → применится встроенный дефолт."
        placeholder={SYSTEM_PLACEHOLDER}
        rows={6}
        value={systemPrompt}
        onChange={setSystemPrompt}
      />
      <PromptField
        label="После истории (необязательно)"
        hint="Доп. инструкция, вставляемая после истории — последнее напоминание модели перед каждым новым битом."
        placeholder="Доп. инструкция перед каждым битом"
        rows={6}
        value={postHistory}
        onChange={setPostHistory}
      />
      <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: "8px 16px" }}>
        <Button
          size="l"
          stretched
          disabled={!valid || submitting}
          onClick={() =>
            onSubmit({
              name: name.trim(),
              systemPrompt: systemPrompt,
              postHistoryInstruction: postHistory,
            })
          }
        >
          {initial ? "Сохранить" : "Создать шаблон"}
        </Button>
        {onDelete && (
          <Button size="m" mode="plain" stretched onClick={onDelete} disabled={submitting}>
            Удалить шаблон
          </Button>
        )}
      </div>
    </Section>
  );
}
