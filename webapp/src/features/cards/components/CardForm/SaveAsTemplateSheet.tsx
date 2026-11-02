import { Button, Checkbox, Stack, Text, TextInput } from "@mantine/core";
import { useState } from "react";
import { ResponsiveSheet } from "../../../../shared/components/ResponsiveSheet";
import { useToast } from "../../../../shared/toast";
import { createCardTemplate } from "../../api/card-templates-api";
import { cardToTemplate, type CardTemplateSource } from "../../lib/cardToTemplate";

interface SaveAsTemplateSheetProps {
  opened: boolean;
  onClose: () => void;
  /** Название карточки — подставляется как название шаблона. */
  cardName: string;
  card: CardTemplateSource;
}

/**
 * «Сохранить как шаблон»: структура карточки (системный промпт, поля, инструменты) уходит в новый
 * шаблон. Сгенерированный текст, основной промпт, референсы и пресет — нет: они про этого персонажа.
 */
export function SaveAsTemplateSheet({ opened, onClose, cardName, card }: SaveAsTemplateSheetProps) {
  const { showToast } = useToast();
  const [name, setName] = useState(cardName);
  const [onlyEnabled, setOnlyEnabled] = useState(true);
  const [saving, setSaving] = useState(false);

  const disabledCount = card.categories.filter((c) => !c.enabled).length;
  const template = cardToTemplate(name, card, onlyEnabled);
  // Пустой шаблон сервер не примет (fieldsError) — кнопку выключаем заранее.
  const canSave = template.name.length > 0 && template.fields.length > 0 && !saving;

  const save = () => {
    setSaving(true);
    createCardTemplate(template)
      .then(() => {
        showToast({ type: "success", message: `Шаблон «${template.name}» создан` });
        onClose();
      })
      .catch((err) => {
        console.warn("Не удалось создать шаблон карточки", err);
        showToast({ type: "error", message: "Не удалось создать шаблон" });
      })
      .finally(() => setSaving(false));
  };

  return (
    <ResponsiveSheet opened={opened} onClose={onClose} title="Новый шаблон">
      <Stack gap="md">
        <Text size="sm" c="dimmed">
          Из карточки возьмём системный промпт, поля (примеры формата и порядок) и тумблеры инструментов.
          Сгенерированный текст, основной промпт и картинки в шаблон не попадут.
        </Text>
        <TextInput
          label="Название шаблона"
          withAsterisk
          data-autofocus
          value={name}
          onChange={(e) => setName(e.currentTarget.value)}
        />
        {disabledCount > 0 && (
          <Checkbox
            label="Только включённые поля"
            description={`Выключенные (${disabledCount}) в шаблон не пойдут`}
            checked={onlyEnabled}
            onChange={(e) => setOnlyEnabled(e.currentTarget.checked)}
          />
        )}
        <Button fullWidth disabled={!canSave} loading={saving} onClick={save}>
          Создать шаблон
        </Button>
      </Stack>
    </ResponsiveSheet>
  );
}
