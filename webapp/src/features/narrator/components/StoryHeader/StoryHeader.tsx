import { ActionIcon, Text } from "@mantine/core";
import { GitBranch, Settings } from "lucide-react";
import type { StoryAvatarRef } from "../../types/story";
import { StoryCast } from "../StoryCast";
import { BackNavButton } from "../../../../shared/components/BackNavButton";
import styles from "./StoryHeader.module.css";

interface StoryHeaderProps {
  /** Название истории или имя книги знаний. */
  title: string;
  /** До 5 аватаров персонажей и персон книги (порядок книги). */
  avatars: StoryAvatarRef[];
  onGraphClick: () => void;
  onSettingsClick: () => void;
}

/**
 * Шапка истории: «Назад» (только в браузере), стопка аватаров книги (нажатие — галерея их картинок),
 * название, граф веток и настройки.
 */
export function StoryHeader({ title, avatars, onGraphClick, onSettingsClick }: StoryHeaderProps) {
  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <BackNavButton />
        <div className={styles.avatars}>
          {/* Пять аватаров на телефоне оставили бы названию ~80px — показываем три места, остальные «+N». */}
          <StoryCast avatars={avatars} size={36} max={3} />
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
