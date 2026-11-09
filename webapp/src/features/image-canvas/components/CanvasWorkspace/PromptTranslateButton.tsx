import { ActionIcon } from "@mantine/core";
import { Languages } from "lucide-react";
import { useState } from "react";
import { translateBlocksApi } from "../../../../shared/api/promptTranslate";
import { TranslateSheet } from "../../../../shared/components/TranslateSheet";
import { LANG_OPTIONS } from "../../../../shared/constants/lang-options";
import type { ComposeTranslateParams } from "../../../../shared/hooks/useComposeTranslate";

interface PromptTranslateButtonProps {
  prompt: string;
  onPick: (text: string) => void;
  disabled?: boolean;
}

/** У холста нет своей сущности перевода — безэнтитный /translate/text (движок сам определяет язык источника). */
async function translatePrompt({ text, targetLang, mode }: ComposeTranslateParams): Promise<string> {
  const [translation] = await translateBlocksApi({ blocks: [text], sourceLang: "auto", targetLang, mode });
  return translation ?? "";
}

/**
 * Перевод промпта — та же шторка, что в RP-чате и у рассказчика. Отличие: исходником сразу берётся
 * текущий промпт (обычно его и переводят — пишут по-русски, а модели понятнее английский),
 * и выбранный перевод заменяет промпт целиком. Пустой промпт — шторка с общим черновиком, как в чатах.
 */
export function PromptTranslateButton({ prompt, onPick, disabled }: PromptTranslateButtonProps) {
  const [opened, setOpened] = useState(false);

  return (
    <>
      <ActionIcon
        variant="subtle"
        color="gray"
        onClick={() => setOpened(true)}
        disabled={disabled}
        aria-label="Перевести промпт"
      >
        <Languages size={18} />
      </ActionIcon>
      <TranslateSheet
        opened={opened}
        translate={translatePrompt}
        langOptions={LANG_OPTIONS}
        initialText={prompt.trim() ? prompt : undefined}
        pickHint="Нажмите, чтобы заменить промпт"
        onPick={(text) => {
          onPick(text);
          setOpened(false);
        }}
        onClose={() => setOpened(false)}
      />
    </>
  );
}
