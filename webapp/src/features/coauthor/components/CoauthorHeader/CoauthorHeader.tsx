import { ActionIcon, Badge, SegmentedControl, Text } from "@mantine/core";
import { SlidersHorizontal } from "lucide-react";
import { BackNavButton } from "../../../../shared/components/BackNavButton";
import styles from "./CoauthorHeader.module.css";

export type CoauthorTab = "chat" | "cards";

interface CoauthorHeaderProps {
  name: string;
  cardCount: number;
  pendingCount: number;
  tab: CoauthorTab;
  onTab: (tab: CoauthorTab) => void;
  onSettings: () => void;
}

function cardsWord(count: number): string {
  const mod10 = count % 10;
  if (mod10 === 1 && count % 100 !== 11) return "карточка";
  return mod10 >= 2 && mod10 <= 4 && (count % 100 < 12 || count % 100 > 14) ? "карточки" : "карточек";
}

/**
 * Шапка чата соавтора: «Назад» (только в браузере), название, число карточек, настройки. Вкладки «Чат / Карточки» — только на
 * телефоне: на ПК обе панели стоят рядом (CSS прячет переключатель). Счётчик на «Карточках» —
 * ожидающие решения правки: виден из чата, куда идти.
 */
export function CoauthorHeader({ name, cardCount, pendingCount, tab, onTab, onSettings }: CoauthorHeaderProps) {
  return (
    <header className={styles.header}>
      <div className={styles.row}>
        <BackNavButton />
        <div className={styles.title}>
          <Text fw={600} truncate>
            {name}
          </Text>
          <Text size="xs" c="dimmed">
            Соавтор · {cardCount} {cardsWord(cardCount)}
          </Text>
        </div>
        <ActionIcon variant="subtle" color="gray" size="xl" onClick={onSettings} aria-label="Настройки чата">
          <SlidersHorizontal size={22} />
        </ActionIcon>
      </div>
      <SegmentedControl
        className={styles.tabs}
        fullWidth
        value={tab}
        onChange={(value) => onTab(value as CoauthorTab)}
        data={[
          { value: "chat", label: "Чат" },
          {
            value: "cards",
            label: (
              <span className={styles.tabLabel}>
                Карточки
                {pendingCount > 0 && (
                  <Badge size="sm" circle aria-label={`${pendingCount} ждут решения`}>
                    {pendingCount}
                  </Badge>
                )}
              </span>
            ),
          },
        ]}
      />
    </header>
  );
}
