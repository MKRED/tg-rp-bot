import { Clapperboard } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import {
  ROUTES,
  bookEditPath,
  narratorTemplateEditPath,
  presetEditPath,
  storySettingsPath,
} from "../../app/routes";
import { useTransitionNavigate } from "../../app/useTransitionNavigate";
import { AppPage } from "../../shared/components/AppPage";
import { DeleteButton } from "../../shared/components/DeleteButton";
import { EmptyState } from "../../shared/components/EmptyState";
import { PromptEditorField } from "../../shared/components/PromptEditorField";
import { SettingsCard } from "../../shared/components/SettingsCard";
import { TitleCard } from "../../shared/components/TitleCard";
import { TranslateSettingsCard } from "../../shared/components/TranslateSettingsCard";
import { confirmAction } from "../../shared/telegram/confirm";
import { useToast } from "../../shared/toast";
import {
  AUTO_SCOPE_OPTIONS,
  SCOPE_OPTIONS,
  StoryCompactCard,
  StoryFeedCard,
  StoryLinksCard,
  StoryStatsCard,
  removeStory,
  renameStory,
  updateStoryPremise,
  useStory,
  useStorySettings,
  useStoryStats,
  type StoryLinkTarget,
  type StorySettings,
} from "../../features/narrator";

/** Куда ведёт строка «Состава истории»: редактирование записи, а если её удалили — список. */
function linkPath(target: StoryLinkTarget): string {
  switch (target.kind) {
    case "book":
      return bookEditPath(target.id);
    case "template":
      return target.id !== null ? narratorTemplateEditPath(target.id) : ROUTES.narratorTemplates;
    case "preset":
      return target.id !== null ? presetEditPath(target.id) : ROUTES.presets;
  }
}

/** Настройки истории: название, из чего собрана, премиза, лента, перевод, сжатие, статистика, удаление. */
export function StorySettingsPage() {
  const { id } = useParams<{ id: string }>();
  const storyId = Number(id);
  const navigate = useTransitionNavigate();
  const { showToast } = useToast();
  const { story, loading: storyLoading } = useStory(storyId);
  const { settings, loading: settingsLoading, update } = useStorySettings(storyId);
  const { stats, loading: statsLoading, reload: reloadStats } = useStoryStats(storyId);
  const [deleting, setDeleting] = useState(false);
  const [premise, setPremise] = useState("");
  // Последняя сохранённая премиза — useStory не отдаёт setStory, поэтому держим её здесь.
  const savedPremise = useRef("");

  useEffect(() => {
    if (!story) return;
    setPremise(story.premise);
    savedPremise.current = story.premise;
  }, [story]);

  const handleUpdate = async (patch: Partial<StorySettings>) => {
    if (!(await update(patch))) showToast({ type: "error", message: "Не удалось сохранить настройку" });
  };

  // returnTo — чтобы «Назад» Telegram с экрана книги/шаблона/пресета вернула сюда (BackButtonBridge).
  const openLink = (target: StoryLinkTarget) =>
    navigate(linkPath(target), { state: { returnTo: storySettingsPath(storyId) } });

  const handlePremiseChange = async (next: string) => {
    const trimmed = next.trim();
    setPremise(trimmed);
    if (trimmed === savedPremise.current.trim()) return;
    try {
      const res = await updateStoryPremise(storyId, trimmed);
      savedPremise.current = res.premise;
      setPremise(res.premise);
    } catch (err) {
      console.error("Failed to update story premise", err);
      setPremise(savedPremise.current);
      showToast({ type: "error", message: "Не удалось сохранить премизу" });
    }
  };

  const handleDelete = async () => {
    const ok = await confirmAction("Удалить историю? Все биты будут потеряны.", {
      title: "Удаление истории",
      confirmText: "Удалить",
    });
    if (!ok) return;
    setDeleting(true);
    try {
      await removeStory(storyId);
      navigate(ROUTES.stories);
    } catch (err) {
      console.error("Failed to delete story", err);
      showToast({ type: "error", message: "Не удалось удалить историю" });
      setDeleting(false);
    }
  };

  // Один лоадер на весь экран: три запроса идут параллельно и приходят почти вместе.
  const loading = storyLoading || settingsLoading || statsLoading;

  return (
    <AppPage title="Настройки истории" loading={loading}>
      {!story ? (
        <EmptyState icon={Clapperboard} title="История не найдена" description="Возможно, она была удалена." />
      ) : (
        <>
          <TitleCard
            title={story.title}
            placeholder={story.book.name}
            description="Оставьте пустым, чтобы показывать имя книги знаний"
            ariaLabel="Название истории"
            onRename={async (title) => (await renameStory(storyId, title)).title}
            errorMessage="Не удалось сохранить название"
          />
          <StoryLinksCard story={story} onOpen={openLink} />
          <SettingsCard title="Премиза">
            <PromptEditorField
              header="Сценарий / премиза"
              hint="Куда вести сцену, тон, завязка. В текст истории не попадает, но влияет на следующие биты."
              placeholder="Куда ведём историю, тон, завязка…"
              value={premise}
              onChange={handlePremiseChange}
            />
          </SettingsCard>
          <StoryFeedCard settings={settings} onUpdate={handleUpdate} />
          <TranslateSettingsCard
            settings={settings}
            onUpdate={handleUpdate}
            scopeOptions={SCOPE_OPTIONS}
            autoScopeOptions={AUTO_SCOPE_OPTIONS}
            description="Кнопка перевода под битами и директивами"
          />
          <StoryCompactCard
            storyId={storyId}
            settings={settings}
            onUpdate={handleUpdate}
            stats={stats}
            onChanged={reloadStats}
          />
          <StoryStatsCard stats={stats} />
          <DeleteButton onClick={handleDelete} disabled={deleting}>
            Удалить историю
          </DeleteButton>
        </>
      )}
    </AppPage>
  );
}
