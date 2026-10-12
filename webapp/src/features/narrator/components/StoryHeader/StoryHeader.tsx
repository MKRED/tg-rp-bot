import { ActionIcon, Text } from "@mantine/core";
import { GitBranch, Settings } from "lucide-react";
import type { StoryAvatarRef } from "../../types/story";
import { StoryAvatars } from "../StoryAvatars";
import styles from "./StoryHeader.module.css";

interface StoryHeaderProps {
  /** Название истории или имя книги знаний. */
  title: string;
  /** До 5 аватаров персонажей и персон книги (порядок книги). */
  avatars: StoryAvatarRef[];
  onGraphClick: () => void;
  onSettingsClick: () => void;
}

/** Шапка истории: стопка аватаров книги, название, граф веток и настройки. */
export function StoryHeader({ title, avatars, onGraphClick, onSettingsClick }: StoryHeaderProps) {
  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <div className={styles.avatars}>
          {/* Пять аватаров на телефоне оставили бы названию ~80px — показываем три места, остальные «+N». */}
          <StoryAvatars avatars={avatars} size={36} max={3} />
        </div>
        <Text fw={600} truncate className={styles.title}>
          {title}
        </Text>
        <ActionIcon variant="subtle" color="gray" size="xl" onClick={onGraphClick} aria-label="Граф веток">
          <GitBranch size={22} />
        </ActionIcon>
        <ActionIcon variant="subtle" color="gray" size="xl" onClick={onSettingsClick} aria-label="Настройки истории">
          <Settings size={22} />
        </ActionIcon>
      </div>
    </header>
  );
}
