import { Button, Input, Section, Textarea } from "@telegram-apps/telegram-ui";
import { useState } from "react";
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
    <Section header="Narrator-шаблон" footer="Системный промпт для режима «Режиссёр истории» (без сэмплинга — он в пресете)">
      <Input
        header="Название"
        placeholder="Напр. «Кинематографичный рассказчик»"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <Textarea
        header="Инструкция нарратора"
        placeholder={SYSTEM_PLACEHOLDER}
        value={systemPrompt}
        onChange={(e) => setSystemPrompt(e.target.value)}
      />
      <Textarea
        header="После истории (необязательно)"
        placeholder="Доп. инструкция перед каждым битом"
        value={postHistory}
        onChange={(e) => setPostHistory(e.target.value)}
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
