import { Box, Collapse, SegmentedControl, TextInput } from "@mantine/core";
import { PickerField, type PickerOption } from "../../../../shared/components/PickerField";
import { PromptEditorField } from "../../../../shared/components/PromptEditorField";
import { SettingsCard } from "../../../../shared/components/SettingsCard";
import { CharacterAvatar } from "../../../characters";
import { PersonaAvatar } from "../../../personas";
import type { ReferenceItem } from "../../lib/entryReference";
import { MAX_ENTRY_FIELD_LENGTH } from "../../types/book";
import type { EntryMode } from "./useEntryReference";

const MODE_OPTIONS = [
  { value: "character", label: "Персонаж" },
  { value: "persona", label: "Персона" },
  // Коротко: три варианта должны уместиться в ширину телефона.
  { value: "free", label: "Текст" },
];

interface ContentCardProps {
  name: string;
  mode: EntryMode;
  content: string;
  alias: string;
  characters: ReferenceItem[];
  personas: ReferenceItem[];
  selectedCharacter: ReferenceItem | null;
  selectedPersona: ReferenceItem | null;
  showAlias: boolean;
  onName: (value: string) => void;
  onMode: (value: EntryMode) => void;
  onCharacter: (id: number) => void;
  onPersona: (id: number) => void;
  onContent: (value: string) => void;
  onAlias: (value: string) => void;
}

/** Персонаж/персона как вариант выбора — с аватаром своей фичи. */
const characterOption = (c: ReferenceItem): PickerOption => ({
  id: c.id,
  title: c.name,
  leading: <CharacterAvatar id={c.id} hasImage={c.hasImage} name={c.name} />,
});
const personaOption = (p: ReferenceItem): PickerOption => ({
  id: p.id,
  title: p.name,
  leading: <PersonaAvatar id={p.id} hasImage={p.hasImage} name={p.name} />,
});

/** Карточка «Содержание» записи: название, вид (персонаж/персона/текст), ссылка или текст, псевдоним. */
export function ContentCard(props: ContentCardProps) {
  const { mode } = props;
  return (
    <SettingsCard title="Содержание">
      <TextInput
        label="Название"
        description="Этим названием текст записи оборачивается в промпте модели."
        placeholder="Напр. «Анна» или «Таверна»"
        withAsterisk
        maxLength={MAX_ENTRY_FIELD_LENGTH}
        value={props.name}
        onChange={(e) => props.onName(e.currentTarget.value)}
      />
      {/* Переключатель вида и раскрывашки — один ребёнок Stack карточки: свёрнутые Collapse отдельными
          детьми получили бы gap. Смена вида — одна панель сворачивается, другая раскрывается. */}
      <div>
        <SegmentedControl fullWidth data={MODE_OPTIONS} value={mode} onChange={(v) => props.onMode(v as EntryMode)} />
        <Collapse expanded={mode === "character"}>
          <Box pt="md">
            <PickerField
              label="Персонаж"
              required
              options={props.characters.map(characterOption)}
              value={props.selectedCharacter?.id ?? null}
              selected={props.selectedCharacter && characterOption(props.selectedCharacter)}
              placeholder="Выберите персонажа"
              emptyText="Персонажей пока нет — создайте их в разделе «Персонажи»."
              onChange={props.onCharacter}
            />
          </Box>
        </Collapse>
        <Collapse expanded={mode === "persona"}>
          <Box pt="md">
            <PickerField
              label="Персона"
              required
              options={props.personas.map(personaOption)}
              value={props.selectedPersona?.id ?? null}
              selected={props.selectedPersona && personaOption(props.selectedPersona)}
              placeholder="Выберите персону"
              emptyText="Персон пока нет — создайте их в разделе «Персоны»."
              onChange={props.onPersona}
            />
          </Box>
        </Collapse>
        <Collapse expanded={mode === "free"}>
          <Box pt="md">
            <PromptEditorField
              header="Текст записи"
              hint="Факт о мире, предмете или месте. Включённые записи «Всегда» уходят в промпт модели при каждом бите истории."
              placeholder="Факт о мире, предмете или месте…"
              previewLines={6}
              value={props.content}
              onChange={props.onContent}
            />
          </Box>
        </Collapse>
        {/* Псевдоним зависит от асинхронно загружаемой карточки — появляется плавно, а не «доскакивает». */}
        <Collapse expanded={props.showAlias}>
          <TextInput
            pt="md"
            label={mode === "character" ? "Обращение к пользователю" : "Имя персонажа"}
            description={
              mode === "character"
                ? "Промпт персонажа содержит {{user}}, а рассказчик не отыгрывает персону — укажите, что подставить."
                : "Промпт персоны содержит {{char}}, а рассказчик не привязан к персонажу — укажите, что подставить."
            }
            placeholder={mode === "character" ? "Напр. «Странник»" : "Напр. «Артур»"}
            withAsterisk
            maxLength={MAX_ENTRY_FIELD_LENGTH}
            value={props.alias}
            onChange={(e) => props.onAlias(e.currentTarget.value)}
          />
        </Collapse>
      </div>
    </SettingsCard>
  );
}
