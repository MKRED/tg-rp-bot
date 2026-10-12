import { Avatar, ThemeIcon } from "@mantine/core";
import { Clapperboard } from "lucide-react";
import { useAvatarBatch } from "../../../../shared/avatar/useAvatarBatch";
import { nameInitials } from "../../../../shared/text/initials";
import type { StoryAvatarRef } from "../../types/story";

interface StoryAvatarsProps {
  avatars: StoryAvatarRef[];
  size?: number;
  /** Сколько аватаров показывать; остальные — кружком «+N». Не задано — все. */
  max?: number;
}

/**
 * Стопка аватаров персонажей и персон книги истории (порядок книги). Картинки — одним батч-запросом,
 * пока их нет — инициалы. В книге нет ни одного персонажа или персоны — значок рассказчика.
 */
export function StoryAvatars({ avatars, size = 40, max }: StoryAvatarsProps) {
  const shown = max !== undefined && avatars.length > max ? avatars.slice(0, max - 1) : avatars;
  const rest = avatars.length - shown.length;
  const resolved = useAvatarBatch(shown);

  if (avatars.length === 0) {
    return (
      <ThemeIcon size={size} radius="xl" variant="light">
        <Clapperboard size={size / 2} />
      </ThemeIcon>
    );
  }
  return (
    <Avatar.Group spacing={size / 4}>
      {shown.map((a) => (
        <Avatar key={`${a.type}:${a.id}`} size={size} src={resolved.get(`${a.type}:${a.id}`)} color="accent">
          {nameInitials(a.name)}
        </Avatar>
      ))}
      {rest > 0 && (
        <Avatar size={size} color="gray">
          +{rest}
        </Avatar>
      )}
    </Avatar.Group>
  );
}
