import { ActionIcon, Group, Loader, SegmentedControl, Select, Stack, Text, Textarea, UnstyledButton } from "@mantine/core";
import type { PromptTranslateEngine } from "@tg-rp-bot/shared";
import { Eraser, Languages, SendHorizontal } from "lucide-react";
import { useState } from "react";
import type { LangOption } from "../LangPicker";
import { ResponsiveSheet } from "../ResponsiveSheet";
import { RpText } from "../RpText";
import { useComposeTranslate, type ComposeTranslateParams } from "../../hooks/useComposeTranslate";
import styles from "./TranslateSheet.module.css";

/** Режим перевода черновика: обычный Google Translate либо запрос к нейросети. */
export type TranslateMode = PromptTranslateEngine;

interface TranslateSheetProps {
  opened: boolean;
  /** Функция перевода черновика (RP → /chats/:id, narrator → /stories/:id). */
  translate: (params: ComposeTranslateParams) => Promise<string>;
  /** Список языков (LANG_OPTIONS вызывающей фичи). */
  langOptions: LangOption[];
  onPick: (text: string) => void;
  onClose: () => void;
}

const MODE_KEY = "translate-mode";
const LANG_KEY = "translate-lang";
// Единый черновик поля ввода на все чаты/истории (не привязан к конкретному чату).
const DRAFT_KEY = "translate-draft-text";

const MODE_OPTIONS = [
  { value: "google", label: "Google" },
  { value: "ai", label: "ИИ" },
] satisfies { value: TranslateMode; label: string }[];

/**
 * Шторка перевода черновика сообщения: снизу — поле исходного текста, над ним — результат (нажатие
 * вставляет его в поле ввода чата). Режим Google ↔ ИИ, язык и сам текст поля хранятся в localStorage —
 * один черновик на все чаты и истории. Содержимое монтируется при открытии.
 */
export function TranslateSheet({ opened, translate, langOptions, onPick, onClose }: TranslateSheetProps) {
  return (
    <ResponsiveSheet opened={opened} onClose={onClose} title="Перевод">
      <TranslateSheetBody translate={translate} langOptions={langOptions} onPick={onPick} />
    </ResponsiveSheet>
  );
}

function TranslateSheetBody({ translate: translateFn, langOptions, onPick }: Omit<TranslateSheetProps, "opened" | "onClose">) {
  const { loading, result, error, translate, reset } = useComposeTranslate(translateFn);
  // Черновик поля — общий на все чаты/истории, переживает закрытие шторки и перезагрузку.
  const [text, setText] = useState(() => localStorage.getItem(DRAFT_KEY) ?? "");
  const [mode, setMode] = useState<TranslateMode>(() => (localStorage.getItem(MODE_KEY) === "ai" ? "ai" : "google"));
  const [targetLang, setTargetLang] = useState(() => localStorage.getItem(LANG_KEY) ?? "en");

  const changeText = (t: string) => {
    setText(t);
    localStorage.setItem(DRAFT_KEY, t);
    // Исходник изменился — прежний результат к нему уже не относится.
    if (result || error) reset();
  };
  const changeMode = (m: TranslateMode) => {
    setMode(m);
    localStorage.setItem(MODE_KEY, m);
  };
  const changeLang = (l: string) => {
    setTargetLang(l);
    localStorage.setItem(LANG_KEY, l);
  };

  const run = () => {
    if (loading || !text.trim()) return;
    translate({ text: text.trim(), targetLang, mode });
  };

  return (
    <Stack gap="sm">
      <Group gap="xs" wrap="nowrap">
        <SegmentedControl
          size="sm"
          data={MODE_OPTIONS}
          value={mode}
          onChange={(v) => changeMode(v as TranslateMode)}
          aria-label="Способ перевода"
        />
        <Select
          size="sm"
          className={styles.lang}
          data={langOptions}
          value={targetLang}
          allowDeselect={false}
          onChange={(v) => v && changeLang(v)}
          aria-label="Язык перевода"
        />
        <ActionIcon
          variant="subtle"
          color="gray"
          size="lg"
          onClick={() => changeText("")}
          disabled={!text}
          aria-label="Очистить поле"
        >
          <Eraser size={18} />
        </ActionIcon>
      </Group>

      {/* Результат над полем: нажатие вставляет перевод в сообщение. */}
      <div className={styles.result}>
        {loading ? (
          <Loader size="sm" />
        ) : error ? (
          <Text size="sm" c="red" ta="center">
            {error}
          </Text>
        ) : result ? (
          <UnstyledButton className={styles.card} onClick={() => onPick(result)}>
            <Text className={styles.cardText}>
              <RpText text={result} />
            </Text>
            <Text size="xs" c="dimmed" mt={6}>
              Нажмите, чтобы вставить в сообщение
            </Text>
          </UnstyledButton>
        ) : (
          <Stack align="center" gap={6} c="dimmed">
            <Languages size={28} strokeWidth={1.5} aria-hidden />
            <Text size="sm" ta="center">
              Введите текст ниже и нажмите «Перевести»
            </Text>
          </Stack>
        )}
      </div>

      <Group gap="xs" align="flex-end" wrap="nowrap">
        <Textarea
          className={styles.input}
          autosize
          minRows={1}
          maxRows={5}
          placeholder="Текст для перевода…"
          aria-label="Текст для перевода"
          value={text}
          onChange={(e) => changeText(e.currentTarget.value)}
        />
        <ActionIcon
          size={44}
          radius="xl"
          onClick={run}
          loading={loading}
          disabled={!text.trim()}
          aria-label="Перевести"
        >
          <SendHorizontal size={20} />
        </ActionIcon>
      </Group>
    </Stack>
  );
}
