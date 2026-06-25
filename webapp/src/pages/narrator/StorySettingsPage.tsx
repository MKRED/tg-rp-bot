import { Cell, Input, List, Section, Spinner } from "@telegram-apps/telegram-ui";
import { motion } from "framer-motion";
import { BookOpen, ChevronRight, Clapperboard, SlidersHorizontal, Trash2 } from "lucide-react";
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
import { PageTransition } from "../../shared/components/PageTransition";
import { ExpandableTextarea } from "../../shared/components/ExpandableTextarea";
import { removeStory, renameStory, updateStoryPremise, useStory } from "../../features/narrator";
import { confirmAction } from "../../shared/telegram/confirm";
import { useToast } from "../../shared/toast";
import "./narrator.css";

const ITEM_T = { duration: 0.2, ease: "easeOut" as const };

/**
 * Настройки истории (Narrator): название, ссылки на привязанные книгу/шаблон/пресет (открывают
 * их редакторы), редактируемая премиза и удаление. Зеркало настроек RP-чата под narrator-домен.
 */
export function StorySettingsPage() {
  const { id: idParam } = useParams<{ id: string }>();
  const id = Number(idParam);
  const navigate = useTransitionNavigate();
  const { story, loading } = useStory(id);
  const { showToast } = useToast();

  const [deleting, setDeleting] = useState(false);
  // Локальные поля названия и премизы: правятся свободно, сохраняются по blur.
  const [title, setTitle] = useState("");
  const [premise, setPremise] = useState("");
  // Последние сохранённые значения — база для сравнения на blur (useStory не отдаёт setStory,
  // поэтому держим их в ref'ах, а не пересинхронизируем story).
  const savedTitle = useRef("");
  const savedPremise = useRef("");

  // Подхватываем сохранённые значения, когда история загрузилась.
  useEffect(() => {
    if (!story) return;
    setTitle(story.title ?? "");
    setPremise(story.premise);
    savedTitle.current = story.title ?? "";
    savedPremise.current = story.premise;
  }, [story?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleTitleBlur = async () => {
    const next = title.trim();
    if (next === savedTitle.current) return; // без изменений — не дёргаем API
    try {
      const res = await renameStory(id, next);
      savedTitle.current = res.title ?? "";
      setTitle(res.title ?? "");
    } catch (err) {
      console.error("Failed to rename story", err);
      setTitle(savedTitle.current); // откатываем поле, чтобы UI не врал
      showToast({ type: "error", message: "Не удалось сохранить название" });
    }
  };

  // NB: клик по кнопке «развернуть» внутри ExpandableTextarea уводит фокус с поля → тоже
  // триггерит этот blur. Это приемлемо: при наличии правок премиза просто сохранится раньше.
  const handlePremiseBlur = async () => {
    const next = premise.trim();
    if (next === savedPremise.current.trim()) return;
    try {
      const res = await updateStoryPremise(id, next);
      savedPremise.current = res.premise;
      setPremise(res.premise);
    } catch (err) {
      console.error("Failed to update story premise", err);
      setPremise(savedPremise.current);
      showToast({ type: "error", message: "Не удалось сохранить премизу" });
    }
  };

  const handleDelete = async () => {
    if (deleting) return;
    const ok = await confirmAction("Удалить историю? Все биты будут потеряны.", {
      title: "Удаление истории",
      confirmText: "Удалить",
    });
    if (!ok) return;
    setDeleting(true);
    try {
      await removeStory(id);
      navigate(ROUTES.stories);
    } catch (err) {
      console.error("Failed to delete story", err);
      setDeleting(false);
      showToast({ type: "error", message: "Не удалось удалить историю" });
    }
  };

  if (loading) {
    return (
      <PageTransition>
        <div className="story-page__fullcenter">
          <Spinner size="m" />
        </div>
      </PageTransition>
    );
  }
  if (!story) {
    return (
      <PageTransition>
        <div className="story-page__fullcenter">История не найдена</div>
      </PageTransition>
    );
  }

  // returnTo: после открытия редактора книги/шаблона/пресета кнопка «Назад» вернёт сюда.
  const returnTo = storySettingsPath(id);

  return (
    <PageTransition>
      <div className="story-settings-page">
        {/* Название истории: пусто → в ленте/шапке показываем имя книги. Standalone <Input>. */}
        <div className="story-settings-page__title-field">
          <Input
            header="Название"
            placeholder={story.book.name}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={handleTitleBlur}
          />
          <p className="story-settings-page__title-hint">
            Оставьте пустым, чтобы показывать имя книги знаний
          </p>
        </div>

        <List>
          <Section header="История">
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...ITEM_T, delay: 0 }}
            >
              <Cell
                before={<BookOpen size={24} className="story-settings-page__icon" />}
                after={<ChevronRight size={16} style={{ color: "var(--tg-theme-hint-color)" }} />}
                subtitle="Книга знаний"
                onClick={() => navigate(bookEditPath(story.book.id), { state: { returnTo } })}
              >
                {story.book.name}
              </Cell>
            </motion.div>

            {story.template && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ ...ITEM_T, delay: 0.07 }}
              >
                <Cell
                  before={<Clapperboard size={24} className="story-settings-page__icon" />}
                  after={<ChevronRight size={16} style={{ color: "var(--tg-theme-hint-color)" }} />}
                  subtitle="Narrator-шаблон"
                  onClick={() =>
                    navigate(narratorTemplateEditPath(story.template!.id), { state: { returnTo } })
                  }
                >
                  {story.template.name}
                </Cell>
              </motion.div>
            )}

            {story.preset && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ ...ITEM_T, delay: 0.14 }}
              >
                <Cell
                  before={<SlidersHorizontal size={24} className="story-settings-page__icon" />}
                  after={<ChevronRight size={16} style={{ color: "var(--tg-theme-hint-color)" }} />}
                  subtitle="Пресет генерации"
                  onClick={() =>
                    navigate(presetEditPath(story.preset!.id), { state: { returnTo } })
                  }
                >
                  {story.preset.name}
                </Cell>
              </motion.div>
            )}
          </Section>

          <Section
            header="Сценарий"
            footer="Куда вести сцену, тон, завязка. В текст истории не попадает, но влияет на следующие биты."
          >
            <ExpandableTextarea
              header="Сценарий / премиза"
              placeholder="Куда ведём историю, тон, завязка…"
              rows={6}
              value={premise}
              onChange={(e) => setPremise(e.target.value)}
              onBlur={handlePremiseBlur}
            />
          </Section>

          <Section>
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...ITEM_T, delay: 0.21 }}
            >
              <Cell
                before={<Trash2 size={20} color="#e53935" />}
                onClick={handleDelete}
                style={{ color: "#e53935", cursor: deleting ? "default" : "pointer", opacity: deleting ? 0.5 : 1 }}
              >
                Удалить историю
              </Cell>
            </motion.div>
          </Section>
        </List>
      </div>
    </PageTransition>
  );
}
