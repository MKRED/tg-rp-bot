import { Button } from "@mantine/core";
import { Clapperboard } from "lucide-react";
import { useState } from "react";
import { ROUTES, storyViewPath } from "../../app/routes";
import { useTransitionNavigate } from "../../app/useTransitionNavigate";
import { AppPage } from "../../shared/components/AppPage";
import { PickerField, type PickerOption } from "../../shared/components/PickerField";
import { PromptEditorField } from "../../shared/components/PromptEditorField";
import { SettingsCard } from "../../shared/components/SettingsCard";
import { useToast } from "../../shared/toast";
import { useBooks } from "../../features/knowledge-books";
import { useTemplates } from "../../features/narrator-templates";
import { presetSummary, usePresets } from "../../features/generation-presets";
import { createStory } from "../../features/narrator";

/** Форма создания истории: книга знаний, шаблон рассказчика и пресет (все обязательны), начало и премиза. */
export function StoryNewPage() {
  const navigate = useTransitionNavigate();
  const { showToast } = useToast();
  const { items: books, loading: booksLoading } = useBooks();
  const { items: templates, loading: templatesLoading } = useTemplates();
  const { items: presets, loading: presetsLoading } = usePresets();

  const [bookId, setBookId] = useState<number | null>(null);
  const [templateId, setTemplateId] = useState<number | null>(null);
  const [presetId, setPresetId] = useState<number | null>(null);
  const [openingBeat, setOpeningBeat] = useState("");
  const [premise, setPremise] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const canSubmit = bookId !== null && templateId !== null && presetId !== null && openingBeat.trim().length > 0;

  const handleSubmit = async () => {
    if (bookId === null || templateId === null || presetId === null || !openingBeat.trim()) return;
    setSubmitting(true);
    try {
      const res = await createStory({
        bookId,
        templateId,
        presetId,
        openingBeat: openingBeat.trim(),
        premise: premise.trim(),
      });
      // replace: «Назад» из новой истории ведёт к списку, а не обратно в форму создания.
      navigate(storyViewPath(res.story.id), { replace: true });
    } catch (err) {
      // Остаёмся в форме с заполненным — можно повторить.
      console.error("Failed to create story", err);
      showToast({ type: "error", message: "Не удалось создать историю" });
      setSubmitting(false);
    }
  };

  const bookOptions: PickerOption[] = books.map((b) => ({
    id: b.id,
    title: b.name,
    description: b.description ?? `Записей: ${b.entryCount}`,
  }));
  const templateOptions: PickerOption[] = templates.map((t) => ({ id: t.id, title: t.name }));
  const presetOptions: PickerOption[] = presets.map((p) => ({ id: p.id, title: p.name, description: presetSummary(p) }));

  return (
    <AppPage title="Новая история" description="Мир, правила рассказчика и с чего всё начинается">
      <SettingsCard title="Основа">
        <PickerField
          label="Книга знаний"
          description="Мир истории: персонажи, места, лор"
          required
          placeholder="Выберите книгу знаний"
          options={bookOptions}
          value={bookId}
          loading={booksLoading}
          emptyText="Книг знаний пока нет."
          emptyAction={{ label: "Создать книгу знаний", onClick: () => navigate(ROUTES.bookNew) }}
          onChange={setBookId}
        />
        <PickerField
          label="Шаблон рассказчика"
          description="Промпты, по которым ИИ ведёт историю"
          required
          placeholder="Выберите шаблон"
          options={templateOptions}
          value={templateId}
          loading={templatesLoading}
          emptyText="Шаблонов рассказчика пока нет."
          emptyAction={{ label: "Создать шаблон", onClick: () => navigate(ROUTES.narratorTemplateNew) }}
          onChange={setTemplateId}
        />
        <PickerField
          label="Настройки ИИ"
          description="Пресет генерации: контекст, длина ответа, температура"
          required
          placeholder="Выберите пресет"
          options={presetOptions}
          value={presetId}
          loading={presetsLoading}
          emptyText="Пресетов пока нет."
          emptyAction={{ label: "Создать пресет", onClick: () => navigate(ROUTES.presetNew) }}
          onChange={setPresetId}
        />
      </SettingsCard>

      <SettingsCard title="Начало">
        <PromptEditorField
          header="Стартовое сообщение"
          hint="Показывается дословно как первый бит истории и уходит в контекст модели. Обязательно."
          placeholder="С чего начинается история…"
          previewLines={6}
          value={openingBeat}
          onChange={setOpeningBeat}
        />
        <PromptEditorField
          header="Сценарий / премиза"
          hint="Куда вести сцену, тон, завязка. В текст истории не попадает, но влияет на следующие биты. Необязательно."
          placeholder="Куда ведём историю, тон, завязка…"
          value={premise}
          onChange={setPremise}
        />
      </SettingsCard>

      <Button
        fullWidth
        leftSection={<Clapperboard size={18} />}
        disabled={!canSubmit}
        loading={submitting}
        onClick={handleSubmit}
      >
        Создать историю
      </Button>
    </AppPage>
  );
}
