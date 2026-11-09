import { Anchor, Button, SegmentedControl, Text, Textarea, UnstyledButton } from "@mantine/core";
import { Sparkles } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTransitionNavigate } from "../../../../app/useTransitionNavigate";
import { ROUTES } from "../../../../app/routes";
import type { ComfyAgentStatus } from "@tg-rp-bot/shared";
import type { CanvasState } from "../../hooks/useCanvas";
import { generateBlocker, insertImageTag } from "../../lib/promptTags";
import type { ComfyModelId, ImageCanvas } from "../../types/imageCanvas";
import { PromptTranslateButton } from "./PromptTranslateButton";
import { ReferenceTiles } from "./ReferenceTiles";
import styles from "./CanvasWorkspace.module.css";

/** Пауза ввода, после которой промпт сохраняется на сервер. */
const PROMPT_SAVE_MS = 700;

interface ComposerProps {
  canvas: ImageCanvas;
  actions: CanvasState;
  agent: ComfyAgentStatus | null;
  /** Задать промпт снаружи («Повторить» в галерее). */
  draftPrompt: string | null;
  onDraftPromptApplied: () => void;
}

/** Почему агент не даёт запустить генерацию; null — всё в порядке (или статус ещё не загрузился). */
function agentBlocker(agent: ComfyAgentStatus | null): string | null {
  if (!agent) return null;
  if (!agent.hasToken) return "ПК с ComfyUI не подключён";
  if (!agent.online) return "ПК с ComfyUI не в сети — запустите агента";
  if (agent.agentOutdated) return "Агент на ПК устарел — установите его заново";
  return null;
}

/**
 * Панель холста: картинки, модель, промпт с кнопками вставки `<imageN>` и запуск. Промпт сохраняется
 * сам после паузы ввода — закрыть экран можно в любой момент.
 */
export function Composer({ canvas, actions, agent, draftPrompt, onDraftPromptApplied }: ComposerProps) {
  const navigate = useTransitionNavigate();
  const [prompt, setPrompt] = useState(canvas.prompt);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const savedPrompt = useRef(canvas.prompt);

  const savePrompt = (value: string) => {
    clearTimeout(saveTimer.current);
    if (value === savedPrompt.current) return;
    savedPrompt.current = value;
    void actions.patch({ prompt: value });
  };

  const changePrompt = (value: string) => {
    setPrompt(value);
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => savePrompt(value), PROMPT_SAVE_MS);
  };

  // Уходим с экрана — несохранённый ввод отправляем сразу.
  const latest = useRef(prompt);
  latest.current = prompt;
  useEffect(() => () => savePrompt(latest.current), []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (draftPrompt === null) return;
    changePrompt(draftPrompt);
    onDraftPromptApplied();
  }, [draftPrompt]); // eslint-disable-line react-hooks/exhaustive-deps

  const insertTag = (n: number) => {
    const el = textareaRef.current;
    const start = el?.selectionStart ?? prompt.length;
    const end = el?.selectionEnd ?? prompt.length;
    const next = insertImageTag(prompt, start, end, n);
    changePrompt(next.text);
    // После рендера нового значения — курсор за вставленным тегом, чтобы сразу продолжить фразу.
    setTimeout(() => {
      el?.focus();
      el?.setSelectionRange(next.cursor, next.cursor);
    }, 0);
  };

  const running = canvas.generation.status === "running";
  const inputBlocker = generateBlocker(prompt, canvas.references.length);
  const offline = agentBlocker(agent);
  const blocker = offline ?? inputBlocker;
  // Тег без картинки — ошибка ввода, показываем сразу; пустые поля — только подсказкой на кнопке.
  const tagError = inputBlocker?.startsWith("В промпте") ? inputBlocker : null;

  const start = () => {
    savePrompt(prompt);
    void actions.generate();
  };

  return (
    <div className={styles.composer}>
      <div className={styles.composerRow}>
        <ReferenceTiles canvas={canvas} actions={actions} disabled={running} />
        <SegmentedControl
          ml="auto"
          size="xs"
          value={canvas.model}
          onChange={(value) => void actions.patch({ model: value as ComfyModelId })}
          data={[
            { value: "qwen", label: "Qwen" },
            { value: "qwen_turbo", label: "Turbo" },
          ]}
          aria-label="Модель"
        />
      </div>

      <Textarea
        ref={textareaRef}
        value={prompt}
        onChange={(e) => changePrompt(e.currentTarget.value)}
        onBlur={() => savePrompt(prompt)}
        placeholder={canvas.references.length > 1 ? "<image1> держит предмет с <image2>…" : "Что изменить: «сделай фон ночным», «добавь улыбку»…"}
        autosize
        minRows={2}
        maxRows={6}
        error={tagError}
        aria-label="Что сделать с картинкой"
      />

      {/* Под полем: слева вставка тегов картинок, справа перевод промпта. */}
      <div className={styles.promptTools}>
        <div className={styles.tagButtons}>
          {canvas.references.map((_, i) => (
            <UnstyledButton key={i} onClick={() => insertTag(i + 1)} aria-label={`Вставить <image${i + 1}>`}>
              <Text size="xs" c="dimmed" span className={styles.tagChip}>
                + image{i + 1}
              </Text>
            </UnstyledButton>
          ))}
        </div>
        <PromptTranslateButton prompt={prompt} onPick={changePrompt} />
      </div>

      {offline && (
        <Text size="xs" c="orange">
          {offline}.{" "}
          <Anchor size="xs" onClick={() => navigate(ROUTES.settings)}>
            Настройки → ComfyUI
          </Anchor>
        </Text>
      )}

      {!offline && !tagError && blocker && !running && (
        <Text size="xs" c="dimmed">
          {blocker}
        </Text>
      )}

      <Button
        leftSection={<Sparkles size={16} />}
        disabled={running || Boolean(blocker)}
        loading={actions.busy === "generate"}
        onClick={start}
      >
        {running ? "Идёт генерация…" : "Сгенерировать"}
      </Button>
    </div>
  );
}
