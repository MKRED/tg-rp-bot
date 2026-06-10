import { Avatar } from "@telegram-apps/telegram-ui";
import { characterInitials } from "../lib/initials";
import { useCharacterImage } from "../hooks/useCharacterImage";

interface CharacterAvatarProps {
  id: number;
  hasImage: boolean;
  name: string;
  size?: 20 | 24 | 28 | 40 | 48 | 96;
}

/**
 * Аватар персонажа для списка: догружает картинку построчно (useCharacterImage), а пока её нет
 * (грузится или не задана) — показывает инициалы имени.
 */
export function CharacterAvatar({ id, hasImage, name, size = 40 }: CharacterAvatarProps) {
  const src = useCharacterImage(id, hasImage);
  return <Avatar size={size} src={src} acronym={characterInitials(name)} />;
}
