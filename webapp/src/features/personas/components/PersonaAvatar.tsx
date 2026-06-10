import { Avatar } from "@telegram-apps/telegram-ui";
import { nameInitials } from "../../../shared/text/initials";
import { usePersonaImage } from "../hooks/usePersonaImage";

interface PersonaAvatarProps {
  id: number;
  hasImage: boolean;
  name: string;
  size?: 20 | 24 | 28 | 40 | 48 | 96;
}

/**
 * Аватар персоны для списка: догружает картинку построчно (usePersonaImage), а пока её нет
 * (грузится или не задана) — показывает инициалы имени.
 */
export function PersonaAvatar({ id, hasImage, name, size = 40 }: PersonaAvatarProps) {
  const src = usePersonaImage(id, hasImage);
  return <Avatar size={size} src={src} acronym={nameInitials(name)} />;
}
