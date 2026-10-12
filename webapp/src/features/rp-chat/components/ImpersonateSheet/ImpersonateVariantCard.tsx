import { ActionIcon, Text, UnstyledButton } from "@mantine/core";
import { Globe, Trash2 } from "lucide-react";
import { useState } from "react";
import { RpText } from "../../../../shared/components/RpText";
import { confirmAction } from "../../../../shared/telegram/confirm";
import { useToast } from "../../../../shared/toast";
import { translateText } from "../../api/impersonate-api";
import styles from "./ImpersonateSheet.module.css";

interface ImpersonateVariantCardProps {
  chatId: number;
  /** Текст варианта — в поле ввода попадает именно оригинал, даже если показан перевод. */
  text: string;
  /** Язык перевода из настроек чата. */
  targetLang: string;
  onPick: (text: string) => void;
  onDelete: () => void;
}

/** Вариант реплики: нажатие по тексту — подставить в поле ввода; справа — перевести и удалить. */
export function ImpersonateVariantCard({ chatId, text, targetLang, onPick, onDelete }: ImpersonateVariantCardProps) {
  const { showToast } = useToast();
  const [translation, setTranslation] = useState<string | null>(null);
  const [showTranslation, setShowTranslation] = useState(false);
  const [translating, setTranslating] = useState(false);

  const toggleTranslation = async () => {
    if (translation) {
      setShowTranslation((v) => !v);
      return;
    }
    setTranslating(true);
    try {
      setTranslation(await translateText(chatId, text, targetLang));
      setShowTranslation(true);
    } catch (err) {
      console.error("Failed to translate impersonation variant", err);
      showToast({ type: "error", message: "Не удалось перевести вариант" });
    } finally {
      setTranslating(false);
    }
  };

  const remove = async () => {
    const ok = await confirmAction("Удалить вариант?", { title: "Удаление варианта", confirmText: "Удалить" });
    if (ok) onDelete();
  };

  return (
    <div className={styles.card}>
      <UnstyledButton className={styles.cardText} onClick={() => onPick(text)}>
        <Text component="div" className={styles.text}>
          <RpText text={showTranslation && translation ? translation : text} />
        </Text>
      </UnstyledButton>
      <div className={styles.cardActions}>
        <ActionIcon
          variant={showTranslation ? "light" : "subtle"}
          color={showTranslation ? undefined : "gray"}
          size="lg"
          loading={translating}
          onClick={toggleTranslation}
          aria-label={showTranslation ? "Показать оригинал" : "Перевести"}
          aria-pressed={showTranslation}
        >
          <Globe size={18} />
        </ActionIcon>
        <ActionIcon variant="subtle" color="red" size="lg" onClick={remove} aria-label="Удалить вариант">
          <Trash2 size={18} />
        </ActionIcon>
      </div>
    </div>
  );
}
