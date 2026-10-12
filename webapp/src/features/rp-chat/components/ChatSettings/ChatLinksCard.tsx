import { ThemeIcon } from "@mantine/core";
import { FileText, SlidersHorizontal, User, type LucideIcon } from "lucide-react";
import { ListRow } from "../../../../shared/components/ListCard";
import { SettingsCard } from "../../../../shared/components/SettingsCard";
import { CharacterAvatar } from "../../../characters/components/CharacterAvatar";
import { PersonaAvatar } from "../../../personas/components/PersonaAvatar";
import type { ChatDetail } from "../../types/chat";
import styles from "./ChatLinksCard.module.css";

/** Что открыть по нажатию на строку. */
export type ChatLinkTarget =
  | { kind: "character"; id: number }
  | { kind: "persona"; id: number | null }
  | { kind: "template"; id: number | null }
  | { kind: "preset"; id: number | null };

interface ChatLinksCardProps {
  chat: ChatDetail;
  onOpen: (target: ChatLinkTarget) => void;
}

/** Значок вместо аватара — для строк без картинки (персона удалена, шаблон, пресет). */
function RowIcon({ icon: Icon }: { icon: LucideIcon }) {
  return (
    <ThemeIcon size={40} radius="xl" variant="light" color="gray">
      <Icon size={20} />
    </ThemeIcon>
  );
}

/**
 * Из чего собран чат: персонаж, персона, RP-шаблон, пресет. Строка открывает редактирование записи
 * (если запись удалена — её список).
 */
export function ChatLinksCard({ chat, onOpen }: ChatLinksCardProps) {
  const { character, persona, template, preset } = chat;

  return (
    <SettingsCard title="Состав чата" description="Персонаж, персона и правила — нажмите, чтобы открыть и поправить">
      <div className={styles.rows}>
        <ListRow
          index={0}
          leading={<CharacterAvatar id={character.id} hasImage={character.hasImage} name={character.name} />}
          title={character.name}
          description="Персонаж"
          onClick={() => onOpen({ kind: "character", id: character.id })}
        />
        <ListRow
          index={1}
          leading={
            persona ? <PersonaAvatar id={persona.id} hasImage={persona.hasImage} name={persona.name} /> : <RowIcon icon={User} />
          }
          title={persona?.name ?? "Без персоны"}
          description="Ваша персона"
          onClick={() => onOpen({ kind: "persona", id: persona?.id ?? null })}
        />
        <ListRow
          index={2}
          leading={<RowIcon icon={FileText} />}
          title={template?.name ?? "Без шаблона"}
          description="RP-шаблон"
          onClick={() => onOpen({ kind: "template", id: template?.id ?? null })}
        />
        <ListRow
          index={3}
          leading={<RowIcon icon={SlidersHorizontal} />}
          title={preset?.name ?? "Стандартные настройки"}
          description="Настройки ответа ИИ"
          onClick={() => onOpen({ kind: "preset", id: preset?.id ?? null })}
        />
      </div>
    </SettingsCard>
  );
}
