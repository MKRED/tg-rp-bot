import { Cell, List, Section, Spinner, Switch } from "@telegram-apps/telegram-ui";
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
import { HintedInput } from "../../shared/components/HintedInput";
import { PageTransition } from "../../shared/components/PageTransition";
import { PromptEditorField } from "../../shared/components/PromptEditorField";
import { ExpandableSelect } from "../../shared/components/ExpandableSelect";
import { SegmentedToggle } from "../../shared/components/SegmentedToggle";
import {
  AUTO_SCOPE_OPTIONS,
  CompactSettingsSection,
  LANG_OPTIONS,
  METHOD_OPTIONS,
  SCOPE_OPTIONS,
  removeStory,
  renameStory,
  updateStoryOpeningBeat,
  updateStoryPremise,
  useStory,
  useStorySettings,
  useStoryStats,
} from "../../features/narrator";
import { TokenBudgetBar } from "../../shared/components/TokenBudgetBar";
import { confirmAction } from "../../shared/telegram/confirm";
import { useToast } from "../../shared/toast";
import "./narrator.css";

const ITEM_T = { duration: 0.2, ease: "easeOut" as const };

// Токены — оценка (~), показываем с разделителями разрядов для читаемости.
const fmtTokens = (n: number) => `~${n.toLocaleString("ru-RU")}`;

// Какой из выпадающих списков перевода раскрыт — открытие одного закрывает остальные (как в RP).
type OpenSelect = "lang" | "scope" | "auto" | null;

/**
 * Настройки истории (Narrator): название, ссылки на привязанные книгу/шаблон/пресет (открывают
 * их редакторы), редактируемая премиза и удаление. Зеркало настроек RP-чата под narrator-домен.
 */
export function StorySettingsPage() {
  const { id: idParam } = useParams<{ id: string }>();
  const id = Number(idParam);
  const navigate = useTransitionNavigate();
  const { story, loading } = useStory(id);
  const { settings, loading: settingsLoading, update: updateSettings } = useStorySettings(id);
  const { stats, loading: statsLoading, reload: reloadStats } = useStoryStats(id);
  const { showToast } = useToast();

  const [deleting, setDeleting] = useState(false);
  const [openSelect, setOpenSelect] = useState<OpenSelect>(null);
  const toggleSelect = (key: Exclude<OpenSelect, null>) =>
    setOpenSelect((cur) => (cur === key ? null : key));
  // Локальное поле названия правится свободно, сохраняется по blur. Премиза и первое сообщение —
  // через оверлей PromptEditorField, значение коммитится онным onChange только по нажатию «Сохранить».
  const [title, setTitle] = useState("");
  const [premise, setPremise] = useState("");
  const [openingBeat, setOpeningBeat] = useState("");
  // Последние сохранённые значения — база для сравнения на blur (useStory не отдаёт setStory,
  // поэтому держим их в ref'ах, а не пересинхронизируем story).
  const savedTitle = useRef("");
  const savedPremise = useRef("");
  const savedOpeningBeat = useRef("");

  // Подхватываем сохранённые значения, когда история загрузилась. Первое сообщение — content
  // корневого узла активного пути (messages[0], parentId null): messages всегда начинается
  // с openingBeat, а курсор (activeMessageId) существует всегда для уже созданной истории
  // (см. защиту "openingBeat удалять нельзя" на сервере).
  useEffect(() => {
    if (!story) return;
    setTitle(story.title ?? "");
    setPremise(story.premise);
    setOpeningBeat(story.messages[0]?.content ?? "");
    savedTitle.current = story.title ?? "";
    savedPremise.current = story.premise;
    savedOpeningBeat.current = story.messages[0]?.content ?? "";
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

  const handlePremiseChange = async (next: string) => {
    const trimmed = next.trim();
    setPremise(trimmed);
    if (trimmed === savedPremise.current.trim()) return;
    try {
      const res = await updateStoryPremise(id, trimmed);
      savedPremise.current = res.premise;
      setPremise(res.premise);
    } catch (err) {
      console.error("Failed to update story premise", err);
      setPremise(savedPremise.current);
      showToast({ type: "error", message: "Не удалось сохранить премизу" });
    }
  };

  // В отличие от премизы, первое сообщение не может стать пустым (openingBeat — обязательный
  // авторский текст, сервер отклонит пустую строку) — пустой ввод просто откатываем без запроса.
  const handleOpeningBeatChange = async (next: string) => {
    const trimmed = next.trim();
    if (!trimmed) {
      setOpeningBeat(savedOpeningBeat.current);
      showToast({ type: "error", message: "Первое сообщение не может быть пустым" });
      return;
    }
    setOpeningBeat(trimmed);
    if (trimmed === savedOpeningBeat.current.trim()) return;
    try {
      const res = await updateStoryOpeningBeat(id, trimmed);
      savedOpeningBeat.current = res.content;
      setOpeningBeat(res.content);
    } catch (err) {
      console.error("Failed to update story opening beat", err);
      setOpeningBeat(savedOpeningBeat.current);
      showToast({ type: "error", message: "Не удалось сохранить первое сообщение" });
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
        <List>
          {/* Название истории: пусто → в ленте/шапке показываем имя книги. section-blend-inputs
              убирает «коробку»-фон у FormInput. */}
          <Section className="section-blend-inputs" header="Название">
            <HintedInput
              placeholder={story.book.name}
              hint="Оставьте пустым, чтобы показывать имя книги знаний"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={handleTitleBlur}
            />
          </Section>

          <Section header="История">
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...ITEM_T, delay: 0 }}
            >
              <Cell
                before={<BookOpen size={24} className="story-settings-page__icon" />}
                after={<ChevronRight size={16} style={{ color: "var(--tgui--hint_color)" }} />}
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
                  after={<ChevronRight size={16} style={{ color: "var(--tgui--hint_color)" }} />}
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
                  after={<ChevronRight size={16} style={{ color: "var(--tgui--hint_color)" }} />}
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

          <Section className="section-blend-inputs" header="Начало истории">
            <PromptEditorField
              header="Первое сообщение"
              hint="Дословный текст, с которого начинается история. Правка меняет только сам текст — ИИ его не перегенерирует, дальнейшие биты не затрагивает."
              placeholder="Открытие истории…"
              value={openingBeat}
              onChange={handleOpeningBeatChange}
            />
            <PromptEditorField
              header="Сценарий / премиза"
              hint="Куда вести сцену, тон, завязка. В текст истории не попадает, но влияет на следующие биты."
              placeholder="Куда ведём историю, тон, завязка…"
              value={premise}
              onChange={handlePremiseChange}
            />
          </Section>

          <Section header="Перевод">
            {settingsLoading ? (
              <div style={{ display: "flex", justifyContent: "center", padding: 16 }}>
                <Spinner size="m" />
              </div>
            ) : (
              <>
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ ...ITEM_T, delay: 0 }}
                >
                  <Cell
                    after={
                      <Switch
                        checked={settings.translateEnabled}
                        onChange={(e) => updateSettings({ translateEnabled: e.target.checked })}
                      />
                    }
                    subtitle="Показывать кнопку перевода в ленте истории"
                  >
                    Перевод сообщений
                  </Cell>
                </motion.div>

                {settings.translateEnabled && (
                  <>
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ ...ITEM_T, delay: 0.07 }}
                    >
                      <Cell
                        subtitle="Google Translate или запрос к ИИ"
                        after={
                          <SegmentedToggle
                            options={METHOD_OPTIONS}
                            value={settings.translateMethod}
                            onChange={(value) => updateSettings({ translateMethod: value })}
                          />
                        }
                      >
                        Метод перевода
                      </Cell>
                    </motion.div>

                    <ExpandableSelect
                      title="Язык"
                      subtitle="Язык перевода"
                      options={LANG_OPTIONS}
                      value={settings.translateTargetLang}
                      onChange={(value) => { updateSettings({ translateTargetLang: value }); setOpenSelect(null); }}
                      open={openSelect === "lang"}
                      onToggle={() => toggleSelect("lang")}
                      delay={0.14}
                    />

                    <ExpandableSelect
                      title="Показывать"
                      subtitle="На каких сообщениях показывать кнопку перевода"
                      options={SCOPE_OPTIONS}
                      value={settings.translateScope}
                      onChange={(value) => { updateSettings({ translateScope: value }); setOpenSelect(null); }}
                      open={openSelect === "scope"}
                      onToggle={() => toggleSelect("scope")}
                      delay={0.21}
                    />

                    <ExpandableSelect
                      title="Авто-перевод"
                      subtitle="Переводить новые сообщения сразу"
                      options={AUTO_SCOPE_OPTIONS}
                      value={settings.autoTranslateScope}
                      onChange={(value) => { updateSettings({ autoTranslateScope: value }); setOpenSelect(null); }}
                      open={openSelect === "auto"}
                      onToggle={() => toggleSelect("auto")}
                      delay={0.28}
                    />
                  </>
                )}
              </>
            )}
          </Section>

          {!settingsLoading && (
            <CompactSettingsSection
              storyId={id}
              settings={settings}
              updateSettings={updateSettings}
              stats={stats}
              onChanged={reloadStats}
            />
          )}

          <Section header="Статистика">
            {statsLoading ? (
              <div style={{ display: "flex", justifyContent: "center", padding: 16 }}>
                <Spinner size="m" />
              </div>
            ) : (
              <>
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ ...ITEM_T, delay: 0 }}
                >
                  <Cell
                    after={<span style={{ color: "var(--tgui--hint_color)" }}>{fmtTokens(stats.tokensTotal)}</span>}
                    subtitle="Токенов в сообщениях всех веток"
                  >
                    Вся история
                  </Cell>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ ...ITEM_T, delay: 0.07 }}
                >
                  <Cell
                    after={<span style={{ color: "var(--tgui--hint_color)" }}>{fmtTokens(stats.tokensActiveBranch)}</span>}
                    subtitle="Токенов в сообщениях текущей ветки"
                  >
                    Активная ветка
                  </Cell>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ ...ITEM_T, delay: 0.14 }}
                >
                  <Cell subtitle="Полный запрос к ИИ: активная ветка + промпты">
                    Запрос с промптами
                  </Cell>
                  {/* Полоса «использовано / лимит контекста»; при безграничном пресете лимит = ∞ */}
                  <TokenBudgetBar used={stats.tokensPrompt} limit={stats.contextLimit} />
                </motion.div>
              </>
            )}
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
