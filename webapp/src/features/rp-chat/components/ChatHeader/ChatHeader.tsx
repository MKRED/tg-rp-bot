import { ActionIcon, Text } from "@mantine/core";
import { GitBranch, Settings } from "lucide-react";
import { CharacterAvatar } from "../../../characters/components/CharacterAvatar";
import styles from "./ChatHeader.module.css";

interface ChatHeaderProps {
  character: { id: number; name: string; hasImage: boolean };
  /** Пользовательское название чата; null — имя персонажа. */
  title: string | null;
  onSettingsClick: () => void;
  onGraphClick: () => void;
}

/** Шапка чата: аватар (нажатие — фото целиком), название, граф веток и настройки. */
export function ChatHeader({ character, title, onSettingsClick, onGraphClick }: ChatHeaderProps) {
  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <CharacterAvatar id={character.id} hasImage={character.hasImage} name={character.name} size={40} enlargeable />
        <Text fw={600} truncate className={styles.title}>
          {title ?? character.name}
        </Text>
        <ActionIcon variant="subtle" color="gray" size="xl" onClick={onGraphClick} aria-label="Граф веток">
          <GitBranch size={22} />
        </ActionIcon>
        <ActionIcon variant="subtle" color="gray" size="xl" onClick={onSettingsClick} aria-label="Настройки чата">
          <Settings size={22} />
        </ActionIcon>
      </div>
    </header>
  );
}
