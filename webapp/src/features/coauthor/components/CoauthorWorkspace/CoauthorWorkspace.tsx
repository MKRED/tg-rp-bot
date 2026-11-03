import { useEffect, useRef, useState } from "react";
import { useToast } from "../../../../shared/toast";
import { useCoauthorActions } from "../../hooks/useCoauthorActions";
import { coauthorErrorCodeMessage } from "../../lib/errors";
import { pendingProposals } from "../../lib/proposals";
import type { CoauthorChat, CoauthorProposal } from "../../types/coauthor";
import { CardsPanel } from "../CardsPanel";
import { CoauthorFeed } from "../CoauthorFeed";
import { CoauthorHeader, type CoauthorTab } from "../CoauthorHeader";
import { CoauthorInput, type CoauthorInputHandle } from "../CoauthorInput";
import styles from "./CoauthorWorkspace.module.css";

interface CoauthorWorkspaceProps {
  chat: CoauthorChat;
  setChat: React.Dispatch<React.SetStateAction<CoauthorChat | undefined>>;
  onSettings: () => void;
}

/**
 * Экран чата соавтора. На телефоне — вкладки «Чат / Карточки» (видна одна панель), на ПК — чат слева,
 * карточки справа. Поле ввода живёт в панели чата: «Переделать» в карточках переключает на чат и
 * подставляет черновик просьбы.
 */
export function CoauthorWorkspace({ chat, setChat, onSettings }: CoauthorWorkspaceProps) {
  const { showToast } = useToast();
  const inputRef = useRef<CoauthorInputHandle>(null);
  const [tab, setTab] = useState<CoauthorTab>("chat");
  const [selectedCardId, setSelectedCardId] = useState(chat.cards[0]?.id ?? 0);
  const { send, sendingText, answer, answering, review, reviewing } = useCoauthorActions(chat.id, setChat);

  // Ход, который мы застали идущим (страницу обновили посреди него), упал — узнаём из lastError после
  // опроса. Только на переходе running → нет: ошибку своей отправки уже показал тост, а старая ошибка
  // при обычном открытии чата не к месту.
  const wasRunning = useRef(chat.running);
  useEffect(() => {
    if (wasRunning.current && !chat.running && chat.lastError) {
      showToast({ type: "error", message: coauthorErrorCodeMessage(chat.lastError) });
    }
    wasRunning.current = chat.running;
  }, [chat.running, chat.lastError, showToast]);

  const thinking = sendingText !== null || answering || chat.running;
  const busy = thinking || reviewing;

  const openCard = (cardId: number) => {
    setSelectedCardId(cardId);
    setTab("cards");
  };

  const redo = (proposal: CoauthorProposal) => {
    const card = chat.cards.find((c) => c.id === proposal.cardId);
    const block = card?.blocks.find((b) => b.id === proposal.blockId);
    setTab("chat");
    inputRef.current?.setDraft(`Переделай «${block?.title ?? proposal.blockId}» у ${card?.name ?? "карточки"}: `);
  };

  return (
    <>
      <CoauthorHeader
        name={chat.name}
        cardCount={chat.cards.length}
        pendingCount={pendingProposals(chat).length}
        tab={tab}
        onTab={setTab}
        onSettings={onSettings}
      />
      <div className={styles.body} data-tab={tab}>
        <section className={styles.chatPane} aria-label="Чат">
          <CoauthorFeed
            chat={chat}
            sendingText={sendingText}
            thinking={thinking}
            answering={answering}
            onAnswer={(input) => void answer(input)}
            onOpenCard={openCard}
            onSuggest={(text) => inputRef.current?.setDraft(`${text}. `)}
          />
          <CoauthorInput ref={inputRef} onSend={send} busy={thinking} />
        </section>
        <section className={styles.cardsPane} aria-label="Карточки">
          <CardsPanel
            chat={chat}
            selectedCardId={selectedCardId}
            onSelect={setSelectedCardId}
            busy={busy}
            onReview={(ids, accept) => void review(ids, accept)}
            onRedo={redo}
          />
        </section>
      </div>
    </>
  );
}
