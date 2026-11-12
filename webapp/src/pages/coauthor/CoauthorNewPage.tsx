import { Button } from "@mantine/core";
import { useState } from "react";
import { coauthorViewPath } from "../../app/routes";
import { useTransitionNavigate } from "../../app/useTransitionNavigate";
import { COAUTHOR_LIMITS, CoauthorChatForm, coauthorErrorMessage, createCoauthorChat, type CoauthorChatInput } from "../../features/coauthor";
import { AppPage } from "../../shared/components/AppPage";
import { useToast } from "../../shared/toast";
import { useCoauthorFormOptions } from "./useCoauthorFormOptions";

const EMPTY: CoauthorChatInput = {
  name: "",
  cardIds: [],
  presetId: null,
  systemPrompt: "",
  useAskUser: true,
  useWebSearch: false,
  useImages: true,
  maxRounds: COAUTHOR_LIMITS.rounds.default,
  maxEdits: COAUTHOR_LIMITS.edits.default,
  maxQuestions: COAUTHOR_LIMITS.questions.default,
};

/** Создание чата соавтора: карточки, пресет, промпт. Пустое название — имена карточек через «и». */
export function CoauthorNewPage() {
  const navigate = useTransitionNavigate();
  const { showToast } = useToast();
  const options = useCoauthorFormOptions();
  const [value, setValue] = useState(EMPTY);
  const [submitting, setSubmitting] = useState(false);

  const autoName = value.cardIds
    .map((id) => options.cards.find((c) => c.id === id)?.name)
    .filter(Boolean)
    .join(" и ");
  // Пресет по умолчанию — первый: без пресета ход невозможен, а выбор почти всегда один и тот же.
  const presetId = value.presetId ?? options.presets[0]?.id ?? null;
  const canSubmit = value.cardIds.length > 0 && presetId !== null && !submitting;

  const submit = async () => {
    setSubmitting(true);
    try {
      const { chat } = await createCoauthorChat({ ...value, presetId, name: value.name.trim() || autoName || "Новый чат" });
      navigate(coauthorViewPath(chat.id), { replace: true });
    } catch (err) {
      console.error("Failed to create coauthor chat", err);
      showToast({ type: "error", message: coauthorErrorMessage(err, "Не удалось создать чат") });
      setSubmitting(false);
    }
  };

  return (
    <AppPage title="Новый чат" description="Выберите карточки, которые ИИ будет видеть и править вместе">
      <CoauthorChatForm
        value={{ ...value, presetId }}
        onChange={(patch) => setValue((prev) => ({ ...prev, ...patch }))}
        {...options}
        namePlaceholder={autoName || undefined}
      />
      <Button fullWidth size="md" mt="md" disabled={!canSubmit} loading={submitting} onClick={() => void submit()}>
        Начать чат
      </Button>
    </AppPage>
  );
}
