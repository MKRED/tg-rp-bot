import { Button, Caption, List, Section, Spinner, Textarea } from "@telegram-apps/telegram-ui";
import { useState } from "react";
import { ROUTES, storyViewPath } from "../../app/routes";
import { useTransitionNavigate } from "../../app/useTransitionNavigate";
import { PageTransition } from "../../shared/components/PageTransition";
import { createStory } from "../../features/narrator";
import { useBooks } from "../../features/knowledge-books";
import { useTemplates } from "../../features/narrator-templates";
import { usePresets } from "../../features/generation-presets";
import { useToast } from "../../shared/toast";

const selectStyle: React.CSSProperties = { width: "100%", padding: 10, borderRadius: 8 };

/** Экран создания истории: выбор книги/шаблона/пресета + обязательное открытие + опц. премиза. */
export function StoryNewPage() {
  const navigate = useTransitionNavigate();
  const { showToast } = useToast();
  const { items: books, loading: booksLoading } = useBooks();
  const { items: templates } = useTemplates();
  const { items: presets } = usePresets();

  const [bookId, setBookId] = useState<number | null>(null);
  const [templateId, setTemplateId] = useState<number | null>(null);
  const [presetId, setPresetId] = useState<number | null>(null);
  const [openingBeat, setOpeningBeat] = useState("");
  const [premise, setPremise] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const valid = bookId !== null && openingBeat.trim().length > 0;

  const handleCreate = () => {
    if (!valid || submitting) return;
    setSubmitting(true);
    createStory({
      bookId: bookId!,
      templateId,
      presetId,
      openingBeat: openingBeat.trim(),
      premise: premise.trim(),
    })
      .then((res) => navigate(storyViewPath(res.story.id)))
      .catch(() => {
        setSubmitting(false);
        showToast({ type: "error", message: "Не удалось создать историю" });
      });
  };

  if (booksLoading) {
    return (
      <PageTransition>
        <div style={{ display: "flex", justifyContent: "center", padding: 48 }}>
          <Spinner size="m" />
        </div>
      </PageTransition>
    );
  }

  return (
    <PageTransition>
      <div style={{ paddingBottom: 24 }}>
        <List>
          <Section header="Новая история">
            <div style={{ padding: "8px 16px" }}>
              <Caption level="1">Книга знаний</Caption>
              {books.length === 0 ? (
                <Button size="s" mode="outline" stretched onClick={() => navigate(ROUTES.bookNew)} style={{ marginTop: 6 }}>
                  Сначала создайте книгу знаний
                </Button>
              ) : (
                <select value={bookId ?? ""} onChange={(e) => setBookId(e.target.value ? Number(e.target.value) : null)} style={selectStyle}>
                  <option value="">— выберите книгу —</option>
                  {books.map((b) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              )}
            </div>

            <div style={{ padding: "8px 16px" }}>
              <Caption level="1">Narrator-шаблон (необязательно)</Caption>
              <select value={templateId ?? ""} onChange={(e) => setTemplateId(e.target.value ? Number(e.target.value) : null)} style={selectStyle}>
                <option value="">— дефолтная инструкция —</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>

            <div style={{ padding: "8px 16px" }}>
              <Caption level="1">Пресет генерации (необязательно)</Caption>
              <select value={presetId ?? ""} onChange={(e) => setPresetId(e.target.value ? Number(e.target.value) : null)} style={selectStyle}>
                <option value="">— параметры по умолчанию —</option>
                {presets.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
          </Section>

          <Section header="Старт истории" footer="Открытие показывается дословно как первый бит. Премиза — куда вести сцену (в текст не попадает).">
            <Textarea
              header="Стартовое сообщение (обязательно)"
              placeholder="С чего начинается история…"
              value={openingBeat}
              onChange={(e) => setOpeningBeat(e.target.value)}
            />
            <Textarea
              header="Сценарий / премиза (необязательно)"
              placeholder="Куда ведём историю, тон, завязка…"
              value={premise}
              onChange={(e) => setPremise(e.target.value)}
            />
          </Section>

          <div style={{ padding: 16 }}>
            <Button size="l" stretched disabled={!valid || submitting} onClick={handleCreate}>
              Создать историю
            </Button>
          </div>
        </List>
      </div>
    </PageTransition>
  );
}
