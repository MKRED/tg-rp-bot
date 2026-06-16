import { Button, Input } from "@telegram-apps/telegram-ui";
import { useState } from "react";
import { AvatarPicker } from "../../../shared/components/AvatarPicker";
import { ExpandableTextarea } from "../../../shared/components/ExpandableTextarea";
import { FirstMessagesEditor } from "./FirstMessagesEditor";
import { TagsInput } from "./TagsInput";
import { estimateTokens } from "../../../shared/text/tokens";
import type { CharacterInput } from "../types/character";

interface CharacterFormProps {
  /** Начальные значения (режим редактирования); отсутствуют — режим создания. */
  initial?: CharacterInput;
  submitting: boolean;
  onSubmit: (input: CharacterInput) => void;
  /** Удаление доступно только при редактировании. */
  onDelete?: () => void;
}

/** Форма создания/редактирования персонажа. Состояние держим локально (паттерн Composer). */
export function CharacterForm({ initial, submitting, onSubmit, onDelete }: CharacterFormProps) {
  const [name, setName] = useState(initial?.name ?? "");
  const [image, setImage] = useState<string | null>(initial?.image ?? null);
  const [tags, setTags] = useState<string[]>(initial?.tags ?? []);
  const [prompt, setPrompt] = useState(initial?.prompt ?? "");
  const [firstMessages, setFirstMessages] = useState<string[]>(initial?.firstMessages ?? []);

  const canSubmit = name.trim().length > 0 && !submitting;

  const handleSubmit = () => {
    if (!canSubmit) return;
    onSubmit({
      name: name.trim(),
      image,
      tags,
      prompt,
      // отбрасываем пустые варианты первого сообщения
      firstMessages: firstMessages.map((m) => m.trim()).filter(Boolean),
    });
  };

  return (
    <div className="char-form">
      <AvatarPicker image={image} name={name} onChange={setImage} />

      <Input
        header="Название"
        placeholder="Имя персонажа"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />

      <TagsInput tags={tags} onChange={setTags} />

      <div className="char-field">
        <ExpandableTextarea
          header="Промпт"
          placeholder="Системный промпт персонажа…"
          value={prompt}
          rows={6}
          onChange={(e) => setPrompt(e.target.value)}
        />
        <div className="char-field__meta">
          <span className="char-field__tokens">~{estimateTokens(prompt)} токенов</span>
        </div>
      </div>

      <div className="char-form__section-title">Первое сообщение</div>
      <FirstMessagesEditor messages={firstMessages} onChange={setFirstMessages} />

      <div className="char-form__actions">
        <Button size="l" stretched disabled={!canSubmit} onClick={handleSubmit}>
          {submitting ? "Сохранение…" : "Сохранить"}
        </Button>
        {onDelete && (
          <Button size="l" stretched mode="outline" disabled={submitting} onClick={onDelete}>
            Удалить персонажа
          </Button>
        )}
      </div>
    </div>
  );
}
