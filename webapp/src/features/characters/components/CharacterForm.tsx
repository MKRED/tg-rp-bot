import { Button, Stack, Text, TextInput } from "@mantine/core";
import { useMemo, useState } from "react";
import { AvatarPicker, type AvatarValue } from "../../../shared/components/AvatarPicker";
import { DeleteButton } from "../../../shared/components/DeleteButton";
import { PromptEditorField } from "../../../shared/components/PromptEditorField";
import { SettingsCard } from "../../../shared/components/SettingsCard";
import { useUnsavedChangesGuard } from "../../../shared/telegram/useUnsavedChangesGuard";
import { FirstMessagesEditor } from "./FirstMessagesEditor";
import { CharacterTagsInput } from "./CharacterTagsInput";
import { hasUnsavedChanges, normalizeCharacterDraft } from "../lib/formDirty";
import type { CharacterInput } from "../types/character";

interface CharacterFormProps {
  /** Начальные значения (режим редактирования); отсутствуют — режим создания. */
  initial?: CharacterInput;
  submitting: boolean;
  /** Промис нужен, чтобы форма знала об успехе и сбросила «грязный» снапшот — окно после
   * сохранения не закрывается, а показывает уведомление (см. CharacterEditPage). */
  onSubmit: (input: CharacterInput) => Promise<void>;
  /** Удаление доступно только при редактировании. */
  onDelete?: () => void;
}

/** Форма создания/редактирования персонажа. Состояние держим локально (паттерн Composer). */
export function CharacterForm({ initial, submitting, onSubmit, onDelete }: CharacterFormProps) {
  const [name, setName] = useState(initial?.name ?? "");
  const [image, setImage] = useState<string | null>(initial?.image ?? null);
  const [imageFull, setImageFull] = useState<string | null>(initial?.imageFull ?? null);
  const [tags, setTags] = useState<string[]>(initial?.tags ?? []);
  const [footnote, setFootnote] = useState(initial?.footnote ?? "");
  const [prompt, setPrompt] = useState(initial?.prompt ?? "");
  const [scenario, setScenario] = useState(initial?.scenario ?? "");
  const [firstMessages, setFirstMessages] = useState<string[]>(initial?.firstMessages ?? []);

  // Снапшот «последних сохранённых» значений (изначально — initial, пустой объект в режиме
  // создания) — база для сравнения при определении несохранённых правок. Обновляется после
  // каждого успешного сохранения (см. handleSubmit): окно не закрывается, поэтому initial-проп
  // не меняется, а «грязный» статус должен сброситься сам.
  const [baseline, setBaseline] = useState<CharacterInput>(() =>
    normalizeCharacterDraft({
      name: initial?.name ?? "",
      image: initial?.image ?? null,
      imageFull: initial?.imageFull ?? null,
      tags: initial?.tags ?? [],
      footnote: initial?.footnote ?? "",
      prompt: initial?.prompt ?? "",
      scenario: initial?.scenario ?? "",
      firstMessages: initial?.firstMessages ?? [],
    }),
  );
  const isDirty = useMemo(
    () =>
      hasUnsavedChanges(
        { name, image, imageFull, tags, footnote, prompt, scenario, firstMessages },
        baseline,
      ),
    [name, image, imageFull, tags, footnote, prompt, scenario, firstMessages, baseline],
  );
  useUnsavedChangesGuard(isDirty);

  const canSubmit = name.trim().length > 0 && !submitting;

  // Аватар: выбор фото даёт обе картинки, удаление — null.
  const handleAvatar = (value: AvatarValue | null) => {
    setImage(value?.image ?? null);
    setImageFull(value?.imageFull ?? null);
  };

  const handleSubmit = async () => {
    if (!canSubmit) return;
    const payload = normalizeCharacterDraft({
      name,
      image,
      imageFull,
      tags,
      footnote,
      prompt,
      scenario,
      firstMessages,
    });
    try {
      await onSubmit(payload);
      // Сброс «грязного» статуса на реально сохранённые значения — форма остаётся открытой.
      setBaseline(payload);
    } catch {
      // Ошибку показывает CharacterEditPage (тост) — здесь просто не сбрасываем baseline,
      // чтобы «несохранённые изменения» и confirm на уходе продолжали действовать.
    }
  };

  return (
    <Stack gap="lg">
      <SettingsCard title="Основное">
        <AvatarPicker image={image} imageFull={imageFull} name={name} onChange={handleAvatar} />
        <TextInput
          label="Имя"
          placeholder="Имя персонажа"
          withAsterisk
          value={name}
          onChange={(e) => setName(e.currentTarget.value)}
        />
        <TextInput
          label="Примечание"
          description="Заметка для себя — в чат не попадает"
          value={footnote}
          onChange={(e) => setFootnote(e.currentTarget.value)}
        />
        <CharacterTagsInput tags={tags} onChange={setTags} />
      </SettingsCard>

      <SettingsCard title="Промпты">
        <PromptEditorField
          header="Промпт"
          hint="Описание персонажа для нейросети: кто он, внешность, характер, манера речи."
          placeholder="Системный промпт персонажа…"
          value={prompt}
          previewLines={6}
          onChange={setPrompt}
        />
        <PromptEditorField
          header="Сценарий"
          hint="Куда движется сюжет и какова цель сцены. Попадает в запрос, если в RP-шаблоне включён «Сценарий»."
          placeholder="Куда движется сюжет, цель сцены…"
          value={scenario}
          previewLines={6}
          onChange={setScenario}
        />
      </SettingsCard>

      <SettingsCard title="Первое сообщение" description="С чего персонаж начинает новый чат — бот возьмёт один из вариантов.">
        <FirstMessagesEditor messages={firstMessages} onChange={setFirstMessages} />
      </SettingsCard>

      <Stack gap="sm">
        {isDirty && !submitting && (
          <Text size="sm" c="dimmed" ta="center">
            Есть несохранённые изменения
          </Text>
        )}
        <Button fullWidth disabled={!canSubmit} loading={submitting} onClick={handleSubmit}>
          Сохранить
        </Button>
        {onDelete && (
          <DeleteButton disabled={submitting} onClick={onDelete}>
            Удалить персонажа
          </DeleteButton>
        )}
      </Stack>
    </Stack>
  );
}
