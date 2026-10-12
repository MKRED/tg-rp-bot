import { Switch } from "@mantine/core";
import { SettingsCard } from "../../../../shared/components/SettingsCard";
import type { StorySettings } from "../../types/story";

interface StoryFeedCardProps {
  settings: StorySettings;
  onUpdate: (patch: Partial<StorySettings>) => void;
}

/** Дополнительные кнопки под битами в ленте: откат к биту и правка текста. */
export function StoryFeedCard({ settings, onUpdate }: StoryFeedCardProps) {
  return (
    <SettingsCard title="Лента">
      <Switch
        label="Откат к биту"
        description="Кнопка под каждым битом, кроме последнего: переносит историю на него, как нажатие на узел в графе веток"
        checked={settings.quickRollbackEnabled}
        onChange={(e) => onUpdate({ quickRollbackEnabled: e.currentTarget.checked })}
      />
      <Switch
        label="Редактирование битов"
        description="Правка текста бита на месте — без перегенерации и без новой ветки"
        checked={settings.editEnabled}
        onChange={(e) => onUpdate({ editEnabled: e.currentTarget.checked })}
      />
    </SettingsCard>
  );
}
