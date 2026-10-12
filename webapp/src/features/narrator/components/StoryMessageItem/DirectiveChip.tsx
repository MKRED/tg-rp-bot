import { ActionIcon, Text } from "@mantine/core";
import { Clapperboard, Globe } from "lucide-react";
import type { TranslateControl } from "./translateControl";
import styles from "./StoryMessageItem.module.css";

interface DirectiveChipProps {
  text: string;
  translate?: TranslateControl;
}

/** Директива режиссёра — чип по центру ленты со значком и (по настройкам) кнопкой перевода. */
export function DirectiveChip({ text, translate }: DirectiveChipProps) {
  return (
    <div className={styles.directive}>
      <Clapperboard size={14} className={styles.directiveIcon} aria-hidden />
      <Text size="sm" className={styles.directiveText}>
        {text}
      </Text>
      {translate && (
        <ActionIcon
          variant={translate.active ? "light" : "subtle"}
          color={translate.active ? undefined : "gray"}
          size="md"
          radius="xl"
          loading={translate.pending}
          onClick={translate.onToggle}
          aria-label={translate.active ? "Показать оригинал директивы" : "Перевести директиву"}
          aria-pressed={translate.active}
          {...translate.longPress}
        >
          <Globe size={14} />
        </ActionIcon>
      )}
    </div>
  );
}
