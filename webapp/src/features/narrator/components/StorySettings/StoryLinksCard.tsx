import { ThemeIcon } from "@mantine/core";
import { BookOpen, Clapperboard, SlidersHorizontal, type LucideIcon } from "lucide-react";
import { ListRow } from "../../../../shared/components/ListCard";
import { SettingsCard } from "../../../../shared/components/SettingsCard";
import type { StoryDetail } from "../../types/story";
import styles from "./StoryLinksCard.module.css";

/** Что открыть по нажатию на строку; id null — запись удалена, открываем её список. */
export type StoryLinkTarget =
  | { kind: "book"; id: number }
  | { kind: "template"; id: number | null }
  | { kind: "preset"; id: number | null };

interface StoryLinksCardProps {
  story: StoryDetail;
  onOpen: (target: StoryLinkTarget) => void;
}

function RowIcon({ icon: Icon }: { icon: LucideIcon }) {
  return (
    <ThemeIcon size={40} radius="xl" variant="light" color="gray">
      <Icon size={20} />
    </ThemeIcon>
  );
}

/** Из чего собрана история: книга знаний, шаблон рассказчика, пресет. Строка открывает редактирование записи. */
export function StoryLinksCard({ story, onOpen }: StoryLinksCardProps) {
  const { book, template, preset } = story;

  return (
    <SettingsCard title="Состав истории" description="Мир и правила — нажмите, чтобы открыть и поправить">
      <div className={styles.rows}>
        <ListRow
          index={0}
          leading={<RowIcon icon={BookOpen} />}
          title={book.name}
          description="Книга знаний"
          onClick={() => onOpen({ kind: "book", id: book.id })}
        />
        <ListRow
          index={1}
          leading={<RowIcon icon={Clapperboard} />}
          title={template?.name ?? "Шаблон удалён"}
          description="Шаблон рассказчика"
          onClick={() => onOpen({ kind: "template", id: template?.id ?? null })}
        />
        <ListRow
          index={2}
          leading={<RowIcon icon={SlidersHorizontal} />}
          title={preset?.name ?? "Пресет удалён"}
          description="Настройки ответа ИИ"
          onClick={() => onOpen({ kind: "preset", id: preset?.id ?? null })}
        />
      </div>
    </SettingsCard>
  );
}
