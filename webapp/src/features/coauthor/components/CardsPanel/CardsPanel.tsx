import { Button, Text, UnstyledButton } from "@mantine/core";
import { useState } from "react";
import { isStale, pendingCountByCard, pendingProposals, proposalFor, waitingLabel } from "../../lib/proposals";
import type { CoauthorChat, CoauthorProposal } from "../../types/coauthor";
import { PlainBlock } from "./PlainBlock";
import { ProposalBlock } from "./ProposalBlock";
import styles from "./CardsPanel.module.css";

interface CardsPanelProps {
  chat: CoauthorChat;
  selectedCardId: number;
  onSelect: (cardId: number) => void;
  /** Ход ИИ или решение уже идёт — кнопки решений недоступны (сервер ответил бы busy). */
  busy: boolean;
  onReview: (proposalIds: string[], accept: boolean) => void;
  onRedo: (proposal: CoauthorProposal) => void;
}

/**
 * Карточки чата целиком: переключатель персонажей со счётчиком ждущих правок и блоки выбранной
 * карточки. Блок с правкой показывает diff и решения. «Принять все» — все ждущие правки всех
 * карточек, кроме устаревших (их не принять).
 */
export function CardsPanel({ chat, selectedCardId, onSelect, busy, onReview, onRedo }: CardsPanelProps) {
  const counts = pendingCountByCard(chat);
  const pending = pendingProposals(chat);
  const acceptable = pending.filter((p) => !isStale(chat, p));
  const card = chat.cards.find((c) => c.id === selectedCardId) ?? chat.cards[0];
  // Спиннер — только на блоке, по которому нажали; остальные решения на это время просто недоступны.
  const [acting, setActing] = useState<{ id: string; accept: boolean }>();
  const decide = (ids: string[], accept: boolean) => {
    setActing(ids.length === 1 ? { id: ids[0]!, accept } : undefined);
    onReview(ids, accept);
  };

  return (
    <div className={styles.panel}>
      <div className={styles.chips}>
        {chat.cards.map((c) => {
          const count = counts.get(c.id) ?? 0;
          return (
            <UnstyledButton
              key={c.id}
              className={styles.chip}
              data-active={c.id === card?.id || undefined}
              aria-pressed={c.id === card?.id}
              onClick={() => onSelect(c.id)}
            >
              <span className={styles.chipName}>{c.name}</span>
              {count > 0 && (
                <span className={styles.chipCount} aria-label={`${count} ждут решения`}>
                  {count}
                </span>
              )}
            </UnstyledButton>
          );
        })}
      </div>

      {pending.length > 0 && (
        <div className={styles.reviewBar}>
          <Text size="sm" className={styles.reviewText}>
            {waitingLabel(pending.length)}
          </Text>
          {acceptable.length > 1 && (
            <Button size="compact-sm" disabled={busy} onClick={() => decide(acceptable.map((p) => p.id), true)}>
              Принять все
            </Button>
          )}
        </div>
      )}

      <div className={styles.blocks}>
        {card?.blocks.map((block) => {
          const proposal = proposalFor(chat, card.id, block.id);
          return proposal ? (
            <ProposalBlock
              key={block.id}
              block={block}
              proposal={proposal}
              stale={isStale(chat, proposal)}
              busy={busy}
              loading={busy && acting?.id === proposal.id ? (acting.accept ? "accept" : "reject") : null}
              onAccept={() => decide([proposal.id], true)}
              onReject={() => decide([proposal.id], false)}
              onRedo={() => onRedo(proposal)}
            />
          ) : (
            <PlainBlock key={block.id} block={block} />
          );
        })}
      </div>
    </div>
  );
}
