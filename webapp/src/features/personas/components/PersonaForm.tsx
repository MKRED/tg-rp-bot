import { Button, Input, Textarea } from "@telegram-apps/telegram-ui";
import { useState } from "react";
import { AvatarPicker } from "../../../shared/components/AvatarPicker";
import { estimateTokens } from "../../../shared/text/tokens";
import type { PersonaInput } from "../types/persona";

interface PersonaFormProps {
  /** Начальные значения (режим редактирования); отсутствуют — режим создания. */
  initial?: PersonaInput;
  submitting: boolean;
  onSubmit: (input: PersonaInput) => void;
  /** Удаление доступно только при редактировании. */
  onDelete?: () => void;
}

/** Форма создания/редактирования персоны. Состояние держим локально (паттерн Composer). */
export function PersonaForm({ initial, submitting, onSubmit, onDelete }: PersonaFormProps) {
  const [name, setName] = useState(initial?.name ?? "");
  const [image, setImage] = useState<string | null>(initial?.image ?? null);
  const [footnote, setFootnote] = useState(initial?.footnote ?? "");
  const [prompt, setPrompt] = useState(initial?.prompt ?? "");

  const canSubmit = name.trim().length > 0 && !submitting;

  const handleSubmit = () => {
    if (!canSubmit) return;
    onSubmit({
      name: name.trim(),
      image,
      footnote: footnote.trim() || null,
      prompt,
    });
  };

  return (
    <div className="persona-form">
      <AvatarPicker image={image} name={name} onChange={setImage} />

      <Input
        header="Имя"
        placeholder="Имя персоны"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />

      <Input
        header="Сноска"
        placeholder="Заметка для себя (не влияет на чат)"
        value={footnote}
        onChange={(e) => setFootnote(e.target.value)}
      />

      <div className="persona-field">
        <Textarea
          header="Промпт"
          placeholder="Описание персоны для нейросети…"
          value={prompt}
          rows={6}
          onChange={(e) => setPrompt(e.target.value)}
        />
        <div className="persona-field__meta">
          <span className="persona-field__tokens">~{estimateTokens(prompt)} токенов</span>
        </div>
      </div>

      <div className="persona-form__actions">
        <Button size="l" stretched disabled={!canSubmit} onClick={handleSubmit}>
          {submitting ? "Сохранение…" : "Сохранить"}
        </Button>
        {onDelete && (
          <Button size="l" stretched mode="outline" disabled={submitting} onClick={onDelete}>
            Удалить персону
          </Button>
        )}
      </div>
    </div>
  );
}
