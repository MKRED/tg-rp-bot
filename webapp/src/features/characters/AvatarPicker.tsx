import { Avatar, Button, FileInput } from "@telegram-apps/telegram-ui";
import { type ChangeEvent, useState } from "react";
import { fileToAvatarDataUrl } from "./image";
import { characterInitials } from "./initials";

interface AvatarPickerProps {
  /** Текущий аватар (data URL) или null. */
  image: string | null;
  /** Имя — для инициалов-заглушки, пока аватар не выбран. */
  name: string;
  onChange: (image: string | null) => void;
}

/**
 * Выбор аватара персонажа: превью + загрузка файла (квадратный кроп/даунскейл в image.ts) +
 * удаление. Картинка хранится как data URL прямо в персонаже (поле image).
 */
export function AvatarPicker({ image, name, onChange }: AvatarPickerProps) {
  const [busy, setBusy] = useState(false);

  const handleFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // сброс — иначе повторный выбор того же файла не вызовет onChange
    if (!file) return;
    setBusy(true);
    try {
      const dataUrl = await fileToAvatarDataUrl(file);
      onChange(dataUrl);
    } catch {
      // тихо: некорректный/нечитаемый файл — просто не меняем аватар
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="char-avatar">
      <Avatar size={96} src={image ?? undefined} acronym={characterInitials(name)} />
      <div className="char-avatar__actions">
        <FileInput
          accept="image/*"
          disabled={busy}
          onChange={handleFile}
          label={image ? "Заменить фото" : "Загрузить фото"}
        />
        {image && (
          <Button size="s" mode="outline" disabled={busy} onClick={() => onChange(null)}>
            Удалить фото
          </Button>
        )}
      </div>
    </div>
  );
}
