import { Button, Group, Stack, Text } from "@mantine/core";
import { Sparkles } from "lucide-react";
import { PromptEditorField } from "../../../../shared/components/PromptEditorField";
import { SettingsCard } from "../../../../shared/components/SettingsCard";
import type { CardCategory } from "../../types/card";
import { AskUserQuestionsCarousel } from "./AskUserQuestionsCarousel";
import { useCardGeneration } from "./useCardGeneration";

interface GenerationCardProps {
  cardId: number | undefined;
  categories: CardCategory[];
  presetId: number | null;
  formDirty: boolean;
  saveForm: () => Promise<boolean>;
  /** Ручная правка текста блока — часть «грязного» состояния формы (требует «Сохранить»). */
  onCategoriesChange: (categories: CardCategory[]) => void;
  onPendingQuestions: (categoryId: string, questions: CardCategory["pendingQuestions"]) => void;
  onGenerated: (categoryId: string, content: string) => void;
}

/**
 * Карточка «Генерация»: текст каждого включённого блока (правится вручную) и кнопка под ним по его
 * месту в очереди. Блоки выше первого незаполненного уже готовы — «Перегенерировать»; первый
 * незаполненный — «Сгенерировать»; ниже — кнопки нет (очередь не дошла). Если модель попросила
 * уточнение (ask_user), вместо блока — карусель вопросов.
 */
export function GenerationCard({
  cardId,
  categories,
  presetId,
  formDirty,
  saveForm,
  onCategoriesChange,
  onPendingQuestions,
  onGenerated,
}: GenerationCardProps) {
  const { generatingId, answering, generate, respond } = useCardGeneration({
    cardId,
    formDirty,
    saveForm,
    onPendingQuestions,
    onGenerated,
  });

  const enabled = categories.filter((c) => c.enabled);
  const nextIndex = enabled.findIndex((c) => c.content.trim() === "");
  // Пока блок ждёт ответа на ask_user, очередь дальше не двигаем. Только по включённым: карусель
  // выключенной категории нигде не рисуется, и проверка по всем заблокировала бы кнопки навсегда.
  const hasPendingQuestions = enabled.some((c) => (c.pendingQuestions?.length ?? 0) > 0);
  // Несохранённые правки кнопки не прячут — предупреждение и сохранение внутри generate.
  const canAct = cardId !== undefined && presetId !== null;
  const buttonsDisabled = generatingId !== null || hasPendingQuestions;

  const updateContent = (id: string, content: string) => {
    onCategoriesChange(categories.map((c) => (c.id === id ? { ...c, content } : c)));
  };

  return (
    <SettingsCard
      title="Генерация"
      description={
        !canAct
          ? cardId === undefined
            ? "Сначала сохраните карточку."
            : "Выберите пресет ИИ, чтобы включить генерацию."
          : "Блоки пишутся по очереди; готовый текст можно поправить вручную."
      }
    >
      {enabled.length === 0 && (
        <Text size="sm" c="dimmed">
          Включите хотя бы одну категорию в структуре, чтобы начать генерацию.
        </Text>
      )}
      {enabled.map((category, index) => {
        const title = category.title || "…";
        const pending = category.pendingQuestions;
        if (pending && pending.length > 0) {
          return (
            <AskUserQuestionsCarousel
              key={category.id}
              categoryTitle={title}
              questions={pending}
              submitting={answering}
              onSubmit={(answers) => void respond(category.id, { skipped: false, answers })}
              onSkipAll={() => void respond(category.id, { skipped: true })}
            />
          );
        }

        const isRegenerate = nextIndex === -1 || index < nextIndex;
        const isNext = index === nextIndex;
        return (
          <Stack key={category.id} gap="xs">
            <PromptEditorField
              header={category.title || "Без названия"}
              placeholder="Ещё не сгенерирован…"
              value={category.content}
              previewLines={4}
              onChange={(value) => updateContent(category.id, value)}
            />
            {canAct && isRegenerate && (
              <Group justify="flex-end">
                <Button
                  variant="subtle"
                  size="compact-sm"
                  loading={generatingId === category.id}
                  disabled={buttonsDisabled}
                  onClick={() => void generate(category, true)}
                >
                  Перегенерировать
                </Button>
              </Group>
            )}
            {canAct && isNext && (
              <Button
                fullWidth
                leftSection={<Sparkles size={18} />}
                loading={generatingId === category.id}
                disabled={buttonsDisabled}
                onClick={() => void generate(category, false)}
              >
                {`Сгенерировать «${title}»`}
              </Button>
            )}
          </Stack>
        );
      })}
    </SettingsCard>
  );
}
