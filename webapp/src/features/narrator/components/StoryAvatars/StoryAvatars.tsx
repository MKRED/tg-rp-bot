import { Avatar, ThemeIcon } from "@mantine/core";
import { Clapperboard } from "lucide-react";
import { useAvatarBatch } from "../../../../shared/avatar/useAvatarBatch";
import { nameInitials } from "../../../../shared/text/initials";
import type { StoryAvatarRef } from "../../types/story";

interface StoryAvatarsProps {
  avatars: StoryAvatarRef[];
  size?: number;
}

/**
 * Стопка аватаров персонажей и персон книги истории (порядок книги). Картинки — одним батч-запросом,
 * пока их нет — инициалы. В книге нет ни одного персонажа или персоны — значок рассказчика.
 */
export function StoryAvatars({ avatars, size = 40 }: StoryAvatarsProps) {
  const resolved = useAvatarBatch(avatars);

  if (avatars.length === 0) {
    return (
      <ThemeIcon size={size} radius="xl" variant="light">
        <Clapperboard size={size / 2} />
      </ThemeIcon>
    );
  }
  return (
    <Avatar.Group spacing={size / 4}>
      {avatars.map((a) => (
        <Avatar
          key={`${a.type}:${a.id}`}
          size={size}
          src={resolved.get(`${a.type}:${a.id}`)}
          color="accent"
        >
          {nameInitials(a.name)}
        </Avatar>
      ))}
    </Avatar.Group>
  );
}
