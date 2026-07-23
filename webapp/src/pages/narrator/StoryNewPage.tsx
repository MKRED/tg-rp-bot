import { Button, Cell, List, Modal, Section, Spinner } from "@telegram-apps/telegram-ui";
import { BookOpen, ChevronRight, Clapperboard, SlidersHorizontal } from "lucide-react";
import { motion } from "framer-motion";
import { useState } from "react";
import { ROUTES, storyViewPath } from "../../app/routes";
import { useTransitionNavigate } from "../../app/useTransitionNavigate";
import { PageTransition } from "../../shared/components/PageTransition";
import { PromptEditorField } from "../../shared/components/PromptEditorField";
import { createStory } from "../../features/narrator";
import { useBooks } from "../../features/knowledge-books";
import { useTemplates } from "../../features/narrator-templates";
import { presetSummary, usePresets } from "../../features/generation-presets";
import { useToast } from "../../shared/toast";
import "./narrator.css";

const ITEM_TRANSITION = { duration: 0.2, ease: "easeOut" as const };

/** Экран создания истории: выбор книги/шаблона/пресета + обязательное открытие + опц. премиза. */
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

  const [bookOpen, setBookOpen] = useState(false);
  const [templateOpen, setTemplateOpen] = useState(false);
  const [presetOpen, setPresetOpen] = useState(false);

  const selectedBook = books.find((b) => b.id === bookId) ?? null;
  const selectedTemplate = templates.find((t) => t.id === templateId) ?? null;
  const selectedPreset = presets.find((p) => p.id === presetId) ?? null;

  // Книга, шаблон и пресет обязательны; премиза — нет.
  const valid =
    bookId !== null && templateId !== null && presetId !== null && openingBeat.trim().length > 0;

  const handleCreate = () => {
    if (!valid || submitting) return;
    setSubmitting(true);
    createStory({
      bookId: bookId!,
      templateId: templateId!,
      presetId: presetId!,
      openingBeat: openingBeat.trim(),
      premise: premise.trim(),
    })
      .then((res) => navigate(storyViewPath(res.story.id)))
      .catch(() => {
        setSubmitting(false);
        showToast({ type: "error", message: "Не удалось создать историю" });
      });
  };

  if (booksLoading || templatesLoading || presetsLoading) {
    return (
      <PageTransition>
        <div className="story-new-page__center">
          <Spinner size="m" />
        </div>
      </PageTransition>
    );
  }

  return (
    <PageTransition>
      <div className="story-new-page">
        <List>
          <Section header="Новая история">
            {/* Книга знаний — обязательна */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...ITEM_TRANSITION, delay: 0 }}
            >
              <Cell
                before={
                  <BookOpen
                    size={24}
                    className={`story-new-page__icon${bookId === null ? " story-new-page__icon--hint" : ""}`}
                  />
                }
                after={<ChevronRight size={20} className="story-new-page__chevron" />}
                subtitle={
                  bookId === null
                    ? "Обязательно"
                    : (selectedBook?.description ?? `Записей: ${selectedBook?.entryCount ?? 0}`)
                }
                onClick={() => setBookOpen(true)}
              >
                {selectedBook?.name ?? "Выберите книгу знаний"}
              </Cell>
            </motion.div>

            {/* Narrator-шаблон — опционально, дефолт = дефолтная инструкция */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...ITEM_TRANSITION, delay: 0.05 }}
            >
              <Cell
                before={
                  <Clapperboard
                    size={24}
                    className={`story-new-page__icon${templateId === null ? " story-new-page__icon--hint" : ""}`}
                  />
                }
                after={<ChevronRight size={20} className="story-new-page__chevron" />}
                subtitle={templateId === null ? "Обязательно" : "Narrator-шаблон"}
                onClick={() => setTemplateOpen(true)}
              >
                {selectedTemplate?.name ?? "Narrator-шаблон"}
              </Cell>
            </motion.div>

            {/* Пресет генерации — опционально, дефолт = параметры по умолчанию */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...ITEM_TRANSITION, delay: 0.1 }}
            >
              <Cell
                before={
                  <SlidersHorizontal
                    size={24}
                    className={`story-new-page__icon${presetId === null ? " story-new-page__icon--hint" : ""}`}
                  />
                }
                after={<ChevronRight size={20} className="story-new-page__chevron" />}
                subtitle={
                  presetId === null
                    ? "Обязательно"
                    : (selectedPreset ? presetSummary(selectedPreset) : "Пресет генерации")
                }
                onClick={() => setPresetOpen(true)}
              >
                {selectedPreset?.name ?? "Пресет генерации"}
              </Cell>
            </motion.div>
          </Section>

          <Section className="section-blend-inputs" header="Старт истории">
            <PromptEditorField
              header="Стартовое сообщение (обязательно)"
              hint="Показывается дословно как первый бит истории и уходит в контекст модели."
              placeholder="С чего начинается история…"
              previewLines={6}
              value={openingBeat}
              onChange={setOpeningBeat}
            />
            <PromptEditorField
              header="Сценарий / премиза (необязательно)"
              hint="Куда вести сцену, тон, завязка. В текст истории не попадает, но влияет на следующие биты."
              placeholder="Куда ведём историю, тон, завязка…"
              value={premise}
              onChange={setPremise}
            />
          </Section>
        </List>

        <motion.div
          className="story-new-page__submit"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...ITEM_TRANSITION, delay: 0.16 }}
        >
          <Button size="l" stretched disabled={!valid || submitting} onClick={handleCreate}>
            {submitting ? <Spinner size="s" /> : "Создать историю"}
          </Button>
        </motion.div>

        {/* Модал выбора книги знаний */}
        <Modal
          open={bookOpen}
          onOpenChange={setBookOpen}
          header={<Modal.Header>Книга знаний</Modal.Header>}
        >
          {books.length === 0 ? (
            <List>
              <Cell
                before={<BookOpen size={24} className="story-new-page__icon" />}
                subtitle="Сначала создайте книгу знаний"
                onClick={() => {
                  setBookOpen(false);
                  navigate(ROUTES.bookNew);
                }}
              >
                Создать книгу знаний
              </Cell>
            </List>
          ) : (
            <List>
              {books.map((b) => (
                <Cell
                  key={b.id}
                  before={<BookOpen size={24} className="story-new-page__icon" />}
                  subtitle={b.description ?? `Записей: ${b.entryCount}`}
                  onClick={() => {
                    setBookId(b.id);
                    setBookOpen(false);
                  }}
                >
                  {b.name}
                </Cell>
              ))}
            </List>
          )}
        </Modal>

        {/* Модал выбора narrator-шаблона */}
        <Modal
          open={templateOpen}
          onOpenChange={setTemplateOpen}
          header={<Modal.Header>Narrator-шаблон</Modal.Header>}
        >
          {templatesLoading && (
            <div className="story-new-page__center">
              <Spinner size="m" />
            </div>
          )}
          <List>
            {templates.length === 0 ? (
              <Cell
                before={<Clapperboard size={24} className="story-new-page__icon" />}
                subtitle="Сначала создайте narrator-шаблон"
                onClick={() => {
                  setTemplateOpen(false);
                  navigate(ROUTES.narratorTemplateNew);
                }}
              >
                Создать narrator-шаблон
              </Cell>
            ) : (
              templates.map((t) => (
                <Cell
                  key={t.id}
                  before={<Clapperboard size={24} className="story-new-page__icon" />}
                  onClick={() => {
                    setTemplateId(t.id);
                    setTemplateOpen(false);
                  }}
                >
                  {t.name}
                </Cell>
              ))
            )}
          </List>
        </Modal>

        {/* Модал выбора пресета генерации */}
        <Modal
          open={presetOpen}
          onOpenChange={setPresetOpen}
          header={<Modal.Header>Пресет генерации</Modal.Header>}
        >
          {presetsLoading && (
            <div className="story-new-page__center">
              <Spinner size="m" />
            </div>
          )}
          <List>
            {presets.length === 0 ? (
              <Cell
                before={<SlidersHorizontal size={24} className="story-new-page__icon" />}
                subtitle="Сначала создайте пресет генерации"
                onClick={() => {
                  setPresetOpen(false);
                  navigate(ROUTES.presetNew);
                }}
              >
                Создать пресет генерации
              </Cell>
            ) : (
              presets.map((p) => (
                <Cell
                  key={p.id}
                  before={<SlidersHorizontal size={24} className="story-new-page__icon" />}
                  subtitle={presetSummary(p)}
                  onClick={() => {
                    setPresetId(p.id);
                    setPresetOpen(false);
                  }}
                >
                  {p.name}
                </Cell>
              ))
            )}
          </List>
        </Modal>
      </div>
    </PageTransition>
  );
}
