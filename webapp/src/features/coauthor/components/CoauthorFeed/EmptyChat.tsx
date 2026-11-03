import { Button, Stack, Text } from "@mantine/core";
import { Feather } from "lucide-react";
import type { CoauthorChat } from "../../types/coauthor";
import styles from "./CoauthorFeed.module.css";

/**
 * Подсказки первого сообщения. Первая — заполнить пустые блоки карточки с учётом остальных: ровно
 * тот случай, ради которого раздел (вторая сестра, у которой модель не знала о первой).
 */
function suggestions(chat: CoauthorChat): string[] {
  const list: string[] = [];
  const withEmpty = chat.cards.find((c) => c.blocks.some((b) => !b.content.trim()));
  if (withEmpty && chat.cards.length > 1) list.push(`Заполни пустые блоки карточки «${withEmpty.name}» с учётом остальных карточек`);
  if (chat.cards.length > 1) {
    list.push("Проверь, что карточки не противоречат друг другу");
    list.push("Свяжи персонажей общей историей");
  } else {
    list.push("Что в этой карточке стоит доработать?");
  }
  return list;
}

/** Пустой чат: что умеет соавтор и готовые первые сообщения — нажатие подставляет текст в поле. */
export function EmptyChat({ chat, onSuggest }: { chat: CoauthorChat; onSuggest: (text: string) => void }) {
  return (
    <div className={styles.empty}>
      <Stack gap="md" align="center">
        <Feather size={36} className={styles.emptyIcon} aria-hidden />
        <Text fw={600} ta="center">
          ИИ видит все карточки чата целиком
        </Text>
        <Text size="sm" c="dimmed" ta="center" maw={360}>
          Попросите поправить одну карточку с оглядкой на другие или поменять несколько сразу. Каждую правку вы
          примете или отклоните во вкладке «Карточки».
        </Text>
        <Stack gap="xs" w="100%" maw={420}>
          {suggestions(chat).map((text) => (
            <Button key={text} variant="default" className={styles.suggestion} onClick={() => onSuggest(text)}>
              {text}
            </Button>
          ))}
        </Stack>
      </Stack>
    </div>
  );
}
