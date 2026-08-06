import { Button, Cell, Checkbox, Input, List, Section, Spinner } from "@telegram-apps/telegram-ui";
import { useState } from "react";
import { useParams } from "react-router-dom";
import { ROUTES } from "../../app/routes";
import { useTransitionNavigate } from "../../app/useTransitionNavigate";
import { PageTransition } from "../../shared/components/PageTransition";
import { PromptEditorField } from "../../shared/components/PromptEditorField";
import { SectionActions } from "../../shared/components/SectionActions";
import { assembleExportPrompt, useCard, type Card } from "../../features/cards";
import { createCharacter } from "../../features/characters";
import { createPersona } from "../../features/personas";
import { useToast } from "../../shared/toast";
import "./cards.css";

interface CardExportFormProps {
  card: Card;
}

/**
 * Сама форма выгрузки — отдельный компонент, монтируется только когда карточка уже загружена
 * (см. гейт в CardExportPage), чтобы useState(initial) корректно взял значения из card один раз,
 * без лишнего useEffect-синка (тот же приём, что CardEditPage → CardForm).
 */
function CardExportForm({ card }: CardExportFormProps) {
  const navigate = useTransitionNavigate();
  const { showToast } = useToast();

  const [name, setName] = useState(card.name);
  const [footnote, setFootnote] = useState("");
  const [prompt, setPrompt] = useState(() => assembleExportPrompt(card.categories));
  const [toCharacter, setToCharacter] = useState(true);
  const [toPersona, setToPersona] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const canSubmit = name.trim().length > 0 && (toCharacter || toPersona) && !submitting;

  // Персонаж и персона создаются независимо друг от друга — успех одной не должен блокироваться
  // отказом другой (например, лимит персон исчерпан, а персонаж создастся нормально), поэтому
  // каждая ветка ловит свою ошибку и копит сообщения отдельно, а не падает через Promise.all.
  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    const trimmedName = name.trim();
    const trimmedFootnote = footnote.trim() || null;
    const created: string[] = [];
    const failed: string[] = [];

    if (toCharacter) {
      try {
        await createCharacter({
          name: trimmedName,
          tags: [],
          footnote: trimmedFootnote,
          prompt,
          scenario: "",
          firstMessages: [],
          image: null,
          imageFull: null,
        });
        created.push("Персонаж создан");
      } catch (err) {
        console.error("Не удалось создать персонажа из карточки", err);
        failed.push("Не удалось создать персонажа");
      }
    }

    if (toPersona) {
      try {
        await createPersona({
          name: trimmedName,
          footnote: trimmedFootnote,
          prompt,
          image: null,
          imageFull: null,
        });
        created.push("Персона создана");
      } catch (err) {
        console.error("Не удалось создать персону из карточки", err);
        failed.push("Не удалось создать персону");
      }
    }

    setSubmitting(false);
    if (created.length > 0) showToast({ type: "success", message: created.join(", ") });
    if (failed.length > 0) showToast({ type: "error", message: failed.join(", ") });
    // На список карточек уходим, только если хоть что-то создалось — иначе пользователь остаётся
    // на форме с уже введёнными данными и может повторить попытку.
    if (created.length > 0) navigate(ROUTES.cards);
  };

  return (
    <List>
      <Section className="section-blend-inputs" header="Выгрузка карточки">
        <Input
          header="Название"
          placeholder="Имя персонажа/персоны"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />

        <Input
          header="Примечание"
          placeholder="Заметка для себя (не влияет на генерацию)"
          value={footnote}
          onChange={(e) => setFootnote(e.target.value)}
        />

        <PromptEditorField
          header="Финальный промпт"
          hint="Собран из включённых категорий карточки — можно отредактировать перед созданием."
          value={prompt}
          previewLines={6}
          onChange={setPrompt}
        />

        {/* Клик по всей строке переключает чекбокс (Cell.onClick), не только по его маленькой иконке —
            больший тап-таргет. У самого Checkbox — onClick со stopPropagation: иначе клик по иконке
            всплыл бы и до Cell.onClick, и переключение сработало бы дважды подряд (обратно к исходному
            состоянию). onChange не затронут — событие change у чекбокса не зависит от всплытия click. */}
        <Cell
          before={
            <Checkbox
              checked={toCharacter}
              onClick={(e) => e.stopPropagation()}
              onChange={(e) => setToCharacter(e.target.checked)}
            />
          }
          onClick={() => setToCharacter((v) => !v)}
        >
          Создать персонажа
        </Cell>
        <Cell
          before={
            <Checkbox
              checked={toPersona}
              onClick={(e) => e.stopPropagation()}
              onChange={(e) => setToPersona(e.target.checked)}
            />
          }
          onClick={() => setToPersona((v) => !v)}
        >
          Создать персону
        </Cell>

        <SectionActions>
          <Button size="l" stretched disabled={!canSubmit} onClick={handleSubmit}>
            {submitting ? "Создание…" : "Создать"}
          </Button>
        </SectionActions>
      </Section>
    </List>
  );
}

/**
 * Экран выгрузки карточки (/cards/:id/export): превращает готовую карточку в персонажа и/или
 * персону. Открывается только с уже сохранённой карточки — GenerationSection в CardForm требует
 * того же id, кнопка «Выгрузить» там задизейблена, пока карточка не сохранена.
 */
export function CardExportPage() {
  const params = useParams();
  const id = params.id ? Number(params.id) : undefined;
  const { card, loading, error } = useCard(id);

  if (loading) {
    return (
      <PageTransition>
        <div className="cards-page__fullcenter">
          <Spinner size="m" />
        </div>
      </PageTransition>
    );
  }

  if (error || !card) {
    return (
      <PageTransition>
        <div className="cards-page__fullcenter">Карточка не найдена</div>
      </PageTransition>
    );
  }

  return (
    <PageTransition>
      <div className="cards-page">
        <CardExportForm card={card} />
      </div>
    </PageTransition>
  );
}
