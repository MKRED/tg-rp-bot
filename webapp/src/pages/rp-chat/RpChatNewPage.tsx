import { Box, Button, Collapse } from "@mantine/core";
import { MessageSquarePlus } from "lucide-react";
import { useEffect, useState } from "react";
import { chatViewPath } from "../../app/routes";
import { useTransitionNavigate } from "../../app/useTransitionNavigate";
import { AppPage } from "../../shared/components/AppPage";
import { PickerField, type PickerOption } from "../../shared/components/PickerField";
import { SettingsCard } from "../../shared/components/SettingsCard";
import { useToast } from "../../shared/toast";
import { CharacterAvatar, useCharacter, useCharacters } from "../../features/characters";
import { PersonaAvatar, usePersonas } from "../../features/personas";
import { presetSummary, usePresets } from "../../features/generation-presets";
import { useRpTemplates } from "../../features/rp-templates";
import {
  GreetingField,
  createChat,
  defaultGreeting,
  resolveGreetingIndex,
  type GreetingChoice,
} from "../../features/rp-chat";

/** Форма создания чата: с кем говорим (персонаж, приветствие, своя персона) и как (RP-шаблон, пресет ИИ). */
export function RpChatNewPage() {
  const navigate = useTransitionNavigate();
  const { showToast } = useToast();

  const { items: characters, loading: charsLoading } = useCharacters();
  const { items: personas, loading: personasLoading } = usePersonas();
  const { items: templates, loading: templatesLoading } = useRpTemplates();
  const { items: presets, loading: presetsLoading } = usePresets();

  const [charId, setCharId] = useState<number | null>(null);
  const [personaId, setPersonaId] = useState<number | null>(null);
  const [templateId, setTemplateId] = useState<number | null>(null);
  const [presetId, setPresetId] = useState<number | null>(null);
  const [greeting, setGreeting] = useState<GreetingChoice>(null);
  const [submitting, setSubmitting] = useState(false);

  // Полный персонаж — ради firstMessages (строка списка их не отдаёт). Перезапрос при смене.
  const { character: fullChar, loading: fullCharLoading } = useCharacter(charId ?? undefined);
  // Только если загружен именно выбранный: при смене персонажа (или ошибке загрузки) хук ещё держит
  // прежнего — его приветствия чужие.
  const greetings = fullChar?.id === charId ? fullChar.firstMessages : [];

  // Сменили персонажа — выбор приветствия снова по умолчанию (первое или «нет»).
  useEffect(() => {
    setGreeting(defaultGreeting(greetings.length));
  }, [fullChar?.id, greetings.length]);

  // Пока персонаж грузится, приветствия неизвестны — индекс считать не из чего.
  const canSubmit =
    charId !== null && personaId !== null && templateId !== null && presetId !== null && !fullCharLoading;

  const handleSubmit = async () => {
    if (charId === null || personaId === null || templateId === null || presetId === null) return;
    setSubmitting(true);
    try {
      const chat = await createChat({
        characterId: charId,
        personaId,
        templateId,
        presetId,
        firstMessageIndex: resolveGreetingIndex(greeting, greetings.length),
      });
      // replace: «Назад» из нового чата ведёт к списку чатов, а не обратно в форму создания.
      navigate(chatViewPath(chat.id), { replace: true });
    } catch (err) {
      // Остаёмся в форме с выбранным — можно повторить.
      console.error("Failed to create chat", err);
      showToast({ type: "error", message: "Не удалось создать чат" });
      setSubmitting(false);
    }
  };

  const characterOptions: PickerOption[] = characters.map((c) => ({
    id: c.id,
    title: c.name,
    description: c.tags.length > 0 ? c.tags.join(", ") : undefined,
    leading: <CharacterAvatar id={c.id} hasImage={c.hasImage} name={c.name} />,
  }));
  const personaOptions: PickerOption[] = personas.map((p) => ({
    id: p.id,
    title: p.name,
    description: p.footnote ?? undefined,
    leading: <PersonaAvatar id={p.id} hasImage={p.hasImage} name={p.name} />,
  }));
  const templateOptions: PickerOption[] = templates.map((t) => ({ id: t.id, title: t.name }));
  const presetOptions: PickerOption[] = presets.map((p) => ({
    id: p.id,
    title: p.name,
    description: presetSummary(p),
  }));

  return (
    <AppPage title="Новый чат" description="С кем говорим и по каким правилам">
      <SettingsCard title="Собеседники">
        {/* Приветствие — в одном блоке с персонажем: раскрывается после выбора, без двойного отступа Stack. */}
        <div>
          <PickerField
            label="Персонаж"
            required
            placeholder="Выберите персонажа"
            options={characterOptions}
            value={charId}
            loading={charsLoading}
            emptyText="Персонажей пока нет — создайте их в разделе «Персонажи»."
            onChange={setCharId}
          />
          <Collapse expanded={charId !== null}>
            <Box pt="md">
              <GreetingField
                greetings={greetings}
                loading={fullCharLoading}
                value={greeting}
                onChange={setGreeting}
              />
            </Box>
          </Collapse>
        </div>
        <PickerField
          label="Ваша персона"
          description="От чьего лица вы пишете"
          required
          placeholder="Выберите персону"
          options={personaOptions}
          value={personaId}
          loading={personasLoading}
          emptyText="Персон пока нет — создайте их в разделе «Персоны»."
          onChange={setPersonaId}
        />
      </SettingsCard>

      <SettingsCard title="Правила">
        <PickerField
          label="RP-шаблон"
          description="Промпты, по которым ИИ ведёт ролевую игру"
          required
          placeholder="Выберите RP-шаблон"
          options={templateOptions}
          value={templateId}
          loading={templatesLoading}
          emptyText="RP-шаблонов пока нет — создайте их в разделе «RP-шаблоны»."
          onChange={setTemplateId}
        />
        <PickerField
          label="Настройки ИИ"
          description="Пресет генерации: контекст, длина ответа, температура"
          required
          placeholder="Выберите пресет"
          options={presetOptions}
          value={presetId}
          loading={presetsLoading}
          emptyText="Пресетов пока нет — создайте их в разделе «Настройки ответа ИИ»."
          onChange={setPresetId}
        />
      </SettingsCard>

      <Button
        fullWidth
        leftSection={<MessageSquarePlus size={18} />}
        disabled={!canSubmit}
        loading={submitting}
        onClick={handleSubmit}
      >
        Начать чат
      </Button>
    </AppPage>
  );
}
