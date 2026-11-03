import { ActionIcon, Badge, Button, Group, SegmentedControl, Text } from "@mantine/core";
import { X } from "lucide-react";
import { useState } from "react";
import type { CoauthorBlock, CoauthorProposal } from "../../types/coauthor";
import { BlockDiff, type DiffMode } from "./BlockDiff";
import styles from "./CardsPanel.module.css";

interface ProposalBlockProps {
  block: CoauthorBlock;
  proposal: CoauthorProposal;
  /** Блок изменили после предложения — принять нельзя, только отклонить или попросить переделать. */
  stale: boolean;
  busy: boolean;
  /** Какое решение по этому блоку сейчас отправляется. */
  loading: "accept" | "reject" | null;
  onAccept: () => void;
  onReject: () => void;
  onRedo: () => void;
}

/**
 * Блок с предложенной правкой. Diff — от текста на момент предложения: видно ровно то, что изменил ИИ.
 * Заполнение пустого блока — весь текст новый, переключатель «было/стало» там не нужен.
 */
export function ProposalBlock({ block, proposal, stale, busy, loading, onAccept, onReject, onRedo }: ProposalBlockProps) {
  const [mode, setMode] = useState<DiffMode>("changes");
  const isFill = !proposal.baseContent.trim();

  return (
    <div className={styles.block} data-proposal>
      <Group gap="xs" wrap="nowrap">
        <Text size="sm" fw={600} c="dimmed" className={styles.blockTitle}>
          {block.title}
        </Text>
        <Badge variant="light" color={stale ? "orange" : undefined}>
          {stale ? "блок изменён" : isFill ? "заполнение" : "правка ИИ"}
        </Badge>
      </Group>
      {!isFill && (
        <SegmentedControl
          size="xs"
          className={styles.diffToggle}
          value={mode}
          onChange={(value) => setMode(value as DiffMode)}
          data={[
            { value: "changes", label: "Изменения" },
            { value: "before", label: "Было" },
            { value: "after", label: "Стало" },
          ]}
        />
      )}
      <BlockDiff before={proposal.baseContent} after={proposal.content} mode={isFill ? "changes" : mode} />
      {stale && (
        <Text size="xs" c="orange">
          Блок поменяли после предложения — принять правку нельзя, чтобы не затереть изменения.
        </Text>
      )}
      <Group gap="xs" wrap="nowrap">
        {!stale && (
          <Button className={styles.grow} onClick={onAccept} loading={loading === "accept"} disabled={busy && loading !== "accept"}>
            Принять
          </Button>
        )}
        <Button variant="default" className={stale ? styles.grow : undefined} onClick={onRedo} disabled={busy}>
          Переделать
        </Button>
        <ActionIcon
          variant="default"
          size={36}
          onClick={onReject}
          loading={loading === "reject"}
          disabled={busy && loading !== "reject"}
          aria-label="Отклонить правку"
        >
          <X size={18} />
        </ActionIcon>
      </Group>
    </div>
  );
}
