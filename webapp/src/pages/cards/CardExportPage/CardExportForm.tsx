import { Button, Stack, Switch, TextInput } from "@mantine/core";
import { useState } from "react";
import { ROUTES } from "../../../app/routes";
import { useTransitionNavigate } from "../../../app/useTransitionNavigate";
import { assembleExportPrompt, type Card } from "../../../features/cards";
import { CharacterAvatar, useCharacters } from "../../../features/characters";
import { PersonaAvatar, usePersonas } from "../../../features/personas";
import { PromptEditorField } from "../../../shared/components/PromptEditorField";
import { SettingsCard } from "../../../shared/components/SettingsCard";
import { confirmAction } from "../../../shared/telegram/confirm";
import { useToast } from "../../../shared/toast";
import { exportCard, type ExportTargetMode } from "./exportCard";
import { ExportTargetSection } from "./ExportTargetSection";

interface CardExportFormProps {
  card: Card;
}

/**
 * Форма выгрузки — монтируется только с загруженной карточкой, чтобы useState(initial) взял значения
 * из неё один раз, без синхронизирующего useEffect (тот же приём, что CardEditPage → CardForm).
 */
export function CardExportForm({ card }: CardExportFormProps) {
  const navigate = useTransitionNavigate();
  const { showToast } = useToast();

  const [name, setName] = useState(card.name);
  const [footnote, setFootnote] = useState("");
  const [includeHeaders, setIncludeHeaders] = useState(true);
  const [prompt, setPrompt] = useState(() => assembleExportPrompt(card.categories, true));
  const [toCharacter, setToCharacter] = useState(true);
  const [characterMode, setCharacterMode] = useState<ExportTargetMode>("create");
  const [characterTargetId, setCharacterTargetId] = useState<number | null>(null);
  const [toPersona, setToPersona] = useState(false);
  const [personaMode, setPersonaMode] = useState<ExportTargetMode>("create");
  const [personaTargetId, setPersonaTargetId] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const { items: characters, loading: charactersLoading } = useCharacters();
  const { items: personas, loading: personasLoading } = usePersonas();

  // В режиме «Обновить» нужна выбранная запись — иначе эта сторона тихо ничего бы не сделала.
  const characterReady = !toCharacter || characterMode === "create" || characterTargetId !== null;
  const personaReady = !toPersona || personaMode === "create" || personaTargetId !== null;
  // Обновление меняет только промпт — имя нужно, лишь если хоть одна цель создаётся.
  const hasCreateTarget = (toCharacter && characterMode === "create") || (toPersona && personaMode === "create");
  const hasUpdateTarget = (toCharacter && characterMode === "update") || (toPersona && personaMode === "update");
  const canSubmit =
    (!hasCreateTarget || name.trim().length > 0) &&
    (toCharacter || toPersona) &&
    characterReady &&
    personaReady &&
    !submitting;

  // Переключатель меняет способ сборки промпта — пересобирает поле заново (как выбор формата
  // перед правкой), а не живёт рядом с уже готовым текстом.
  const handleIncludeHeaders = (checked: boolean) => {
    setIncludeHeaders(checked);
    setPrompt(assembleExportPrompt(card.categories, checked));
  };

  const handleSubmit = async () => {
    if (!canSubmit) return;
    if (hasUpdateTarget) {
      const confirmed = await confirmAction(
        "Промпт выбранной записи будет заменён текущим из формы — остальное (имя, примечание, фото и т.д.) останется прежним.",
        { title: "Обновить промпт?", confirmText: "Обновить" },
      );
      if (!confirmed) return;
    }
    setSubmitting(true);
    const { done, failed } = await exportCard({
      name: name.trim(),
      footnote: footnote.trim() || null,
      prompt,
      character: toCharacter ? { mode: characterMode, targetId: characterTargetId } : null,
      persona: toPersona ? { mode: personaMode, targetId: personaTargetId } : null,
    });
    setSubmitting(false);
    if (done.length > 0) showToast({ type: "success", message: done.join(", ") });
    if (failed.length > 0) showToast({ type: "error", message: failed.join(", ") });
    // К списку карточек — только если хоть что-то удалось; иначе остаёмся с введёнными данными.
    if (done.length > 0) navigate(ROUTES.cards);
  };

  return (
    <Stack gap="lg">
      <SettingsCard title="Куда выгрузить">
        <ExportTargetSection
          label="Персонаж"
          description="С кем вы играете в чатах и историях"
          checked={toCharacter}
          onCheckedChange={setToCharacter}
          mode={characterMode}
          onModeChange={setCharacterMode}
          placeholder="Выберите персонажа"
          emptyText="Персонажей пока нет — выберите «Новая запись»."
          options={characters.map((c) => ({
            id: c.id,
            title: c.name,
            description: c.tags.length > 0 ? c.tags.join(", ") : undefined,
            leading: <CharacterAvatar id={c.id} hasImage={c.hasImage} name={c.name} />,
          }))}
          loading={charactersLoading}
          targetId={characterTargetId}
          onTargetChange={setCharacterTargetId}
        />
        <ExportTargetSection
          label="Персона"
          description="Ваш образ в ролевой игре"
          checked={toPersona}
          onCheckedChange={setToPersona}
          mode={personaMode}
          onModeChange={setPersonaMode}
          placeholder="Выберите персону"
          emptyText="Персон пока нет — выберите «Новая запись»."
          options={personas.map((p) => ({
            id: p.id,
            title: p.name,
            description: p.footnote ?? undefined,
            leading: <PersonaAvatar id={p.id} hasImage={p.hasImage} name={p.name} />,
          }))}
          loading={personasLoading}
          targetId={personaTargetId}
          onTargetChange={setPersonaTargetId}
        />
      </SettingsCard>

      <SettingsCard title="Новая запись" description="Имя и примечание создаваемых персонажа или персоны.">
        <TextInput
          label="Название"
          placeholder="Имя персонажа или персоны"
          withAsterisk={hasCreateTarget}
          value={name}
          onChange={(e) => setName(e.currentTarget.value)}
        />
        <TextInput
          label="Примечание"
          description="Заметка для себя — в чат не попадает"
          value={footnote}
          onChange={(e) => setFootnote(e.currentTarget.value)}
        />
      </SettingsCard>

      <SettingsCard title="Промпт" description="Собран из включённых категорий карточки.">
        <Switch
          label="Заголовки категорий"
          description="Каждый блок начинается со строки «# Название категории» — иначе только текст блоков подряд. Переключение пересобирает промпт."
          checked={includeHeaders}
          onChange={(e) => handleIncludeHeaders(e.currentTarget.checked)}
        />
        <PromptEditorField
          header="Финальный промпт"
          hint="Можно отредактировать перед выгрузкой."
          value={prompt}
          previewLines={6}
          onChange={setPrompt}
        />
      </SettingsCard>

      <Button fullWidth disabled={!canSubmit} loading={submitting} onClick={handleSubmit}>
        {hasUpdateTarget && !hasCreateTarget ? "Обновить" : "Выгрузить"}
      </Button>
    </Stack>
  );
}
