import { Button, Collapse, Loader, Stack, Switch, Text } from "@mantine/core";
import {
  COMPACT_FLOOR_MAX_SHARE,
  COMPACT_FLOOR_MIN as FLOOR_MIN,
  COMPACT_WORDS_MAX as WORDS_MAX,
  COMPACT_WORDS_MIN as WORDS_MIN,
} from "@tg-rp-bot/shared";
import { Shrink } from "lucide-react";
import { SettingsCard } from "../../../../../shared/components/SettingsCard";
import { confirmAction } from "../../../../../shared/telegram/confirm";
import { useToast } from "../../../../../shared/toast";
import { useCompactions } from "../../../hooks/useCompactions";
import type { StorySettings, StoryStats } from "../../../types/story";
import { CompactionItem } from "./CompactionItem";
import { ValueSlider } from "./ValueSlider";
import styles from "./StoryCompactCard.module.css";

/** Почему сжатие недоступно. */
const REASON_TEXT: Record<NonNullable<StoryStats["compactReason"]>, string> = {
  unlimited: "Недоступно при безграничном контексте пресета",
  too_small: "Слишком маленькое контекстное окно пресета",
  template_off: "Включите компонент «Краткое содержание» в порядке промптов шаблона",
};

const fmt = (n: number) => n.toLocaleString("ru-RU");

interface StoryCompactCardProps {
  storyId: number;
  settings: StorySettings;
  onUpdate: (patch: Partial<StorySettings>) => Promise<void> | void;
  stats: StoryStats;
  /** Перезагрузить статистику после сжатия/удаления (заполнение контекста меняется). */
  onChanged: () => void;
}

/**
 * Сжатие истории: старые сообщения сворачиваются в краткие пересказы и освобождают контекст. Главный
 * тумблер, под ним — авто-сжатие, до скольки токенов сжимать, объём пересказа, ручное сжатие и список
 * пересказов. Недоступно без лимита контекста, при слишком малом лимите или выключенном компоненте
 * сжатия в шаблоне — тогда тумблер выключен, а под ним причина.
 */
export function StoryCompactCard({ storyId, settings, onUpdate, stats, onChanged }: StoryCompactCardProps) {
  const { showToast } = useToast();
  const { compactions, loading, busy, compact, remove } = useCompactions(storyId);

  const available = stats.compactAvailable;
  const limit = stats.contextLimit ?? 0;
  const floorMax = Math.max(FLOOR_MIN, Math.round(limit * COMPACT_FLOOR_MAX_SHARE));
  // 0 в настройках — «по умолчанию»: 70% лимита.
  const floor = settings.compactFloorTokens > 0 ? settings.compactFloorTokens : Math.round(limit * 0.7);

  const handleCompact = async () => {
    try {
      const created = await compact();
      onChanged();
      showToast(
        created > 0
          ? { type: "success", message: `Создано пересказов: ${created}` }
          : { message: "Историю ещё не нужно сжимать" },
      );
    } catch (err) {
      console.error("Failed to compact story", err);
      showToast({ type: "error", message: err instanceof Error ? err.message : "Не удалось сжать историю" });
    }
  };

  const handleRemove = async (id: number) => {
    const ok = await confirmAction("Удалить этот и все последующие пересказы?", {
      title: "Удаление пересказа",
      confirmText: "Удалить",
    });
    if (!ok) return;
    try {
      await remove(id);
      onChanged();
    } catch (err) {
      console.error("Failed to delete compaction", err);
      showToast({ type: "error", message: "Не удалось удалить пересказ" });
    }
  };

  return (
    <SettingsCard title="Сжатие истории">
      {/* Тумблер и раскрывающиеся поля — в одном блоке: свёрнутый Collapse не получает отступ Stack. */}
      <div>
        <Switch
          label="Сжатие истории"
          description="Старые сообщения сворачиваются в краткий пересказ и освобождают контекст"
          checked={settings.compactEnabled}
          disabled={!available}
          onChange={(e) => onUpdate({ compactEnabled: e.currentTarget.checked })}
        />
        {!available && stats.compactReason && (
          <Text size="sm" c="dimmed" mt="xs">
            {REASON_TEXT[stats.compactReason]}
          </Text>
        )}
        <Collapse expanded={available && settings.compactEnabled}>
          <Stack gap="lg" pt="md">
            <Switch
              label="Авто-сжатие"
              description="Сжимать автоматически при приближении к лимиту контекста"
              checked={settings.compactAutoEnabled}
              onChange={(e) => onUpdate({ compactAutoEnabled: e.currentTarget.checked })}
            />
            <ValueSlider
              label="Сжимать до"
              hint={`При сжатии остаётся примерно столько токенов живой истории (лимит — ${fmt(limit)})`}
              format={(v) => `${fmt(v)} ток.`}
              min={FLOOR_MIN}
              max={floorMax}
              step={500}
              value={Math.max(FLOOR_MIN, Math.min(floor, floorMax))}
              onCommit={(v) => onUpdate({ compactFloorTokens: v })}
            />
            <ValueSlider
              label="Слов в пересказе"
              hint="Рекомендуемый объём каждого пересказа (плейсхолдер {{words}} в промпте сжатия)"
              format={(v) => `~${v}`}
              min={WORDS_MIN}
              max={WORDS_MAX}
              step={50}
              value={Math.max(WORDS_MIN, Math.min(settings.compactWords, WORDS_MAX))}
              onCommit={(v) => onUpdate({ compactWords: v })}
            />
            <Button variant="light" fullWidth leftSection={<Shrink size={18} />} loading={busy} onClick={handleCompact}>
              Сжать сейчас
            </Button>
            {loading ? (
              <div className={styles.center}>
                <Loader size="sm" />
              </div>
            ) : compactions.length === 0 ? (
              <Text size="sm" c="dimmed" ta="center">
                Пересказов пока нет
              </Text>
            ) : (
              <div className={styles.list}>
                {compactions.map((c, i) => (
                  <CompactionItem
                    key={c.id}
                    compaction={c}
                    number={i + 1}
                    busy={busy}
                    onRemove={() => handleRemove(c.id)}
                  />
                ))}
              </div>
            )}
          </Stack>
        </Collapse>
      </div>
    </SettingsCard>
  );
}
