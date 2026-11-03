import { Button, Group, Text } from "@mantine/core";
import { PenLine } from "lucide-react";
import { waitingLabel } from "../../lib/proposals";
import type { CoauthorChat } from "../../types/coauthor";
import styles from "./CoauthorFeed.module.css";

interface EditsChipProps {
  chat: CoauthorChat;
  proposalIds: string[];
  onOpen: (cardId: number) => void;
}

/**
 * Плашка «правки этого хода»: сколько ещё ждут решения и у каких персонажей. Кнопка ведёт к первой
 * ожидающей правке во вкладке «Карточки» — сами правки в ленте не дублируются (весь блок с diff там).
 */
export function EditsChip({ chat, proposalIds, onOpen }: EditsChipProps) {
  const proposals = chat.proposals.filter((p) => proposalIds.includes(p.id));
  if (proposals.length === 0) return null;
  const pending = proposals.filter((p) => p.status === "pending");
  const accepted = proposals.filter((p) => p.status === "accepted").length;
  const names = [...new Set(proposals.map((p) => chat.cards.find((c) => c.id === p.cardId)?.name).filter(Boolean))];
  const target = pending[0] ?? proposals[0]!;

  const status =
    pending.length > 0
      ? waitingLabel(pending.length)
      : accepted > 0
        ? `Принято ${accepted} из ${proposals.length}`
        : "Правки отклонены или заменены";

  return (
    <div className={styles.edits} data-pending={pending.length > 0 || undefined}>
      <Group gap="sm" wrap="nowrap">
        <PenLine size={18} className={styles.editsIcon} aria-hidden />
        <div className={styles.editsText}>
          <Text size="sm" fw={500}>
            {status}
          </Text>
          <Text size="xs" c="dimmed" truncate>
            {names.join(", ")}
          </Text>
        </div>
        <Button size="compact-sm" variant={pending.length > 0 ? "filled" : "default"} onClick={() => onOpen(target.cardId)}>
          {pending.length > 0 ? "Смотреть" : "Открыть"}
        </Button>
      </Group>
    </div>
  );
}
