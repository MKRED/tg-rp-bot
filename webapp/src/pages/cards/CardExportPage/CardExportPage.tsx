import { Button, Cell, Checkbox, Input, List, Section, Spinner, Text } from "@telegram-apps/telegram-ui";
import { Smile, User } from "lucide-react";
import { useState } from "react";
import { useParams } from "react-router-dom";
import { ROUTES } from "../../../app/routes";
import { useTransitionNavigate } from "../../../app/useTransitionNavigate";
import { PageTransition } from "../../../shared/components/PageTransition";
import { PromptEditorField } from "../../../shared/components/PromptEditorField";
import { SectionActions } from "../../../shared/components/SectionActions";
import { confirmAction } from "../../../shared/telegram/confirm";
import { assembleExportPrompt, useCard, type Card } from "../../../features/cards";
import { CharacterAvatar, createCharacter, getCharacter, updateCharacter, useCharacters } from "../../../features/characters";
import { PersonaAvatar, createPersona, getPersona, updatePersona, usePersonas } from "../../../features/personas";
import { useToast } from "../../../shared/toast";
import { ExportTargetSection, type ExportTargetMode } from "./ExportTargetSection";
import "../cards.css";

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
  const [includeHeaders, setIncludeHeaders] = useState(true);
  const [prompt, setPrompt] = useState(() => assembleExportPrompt(card.categories, true));
  const [toCharacter, setToCharacter] = useState(true);
  const [characterMode, setCharacterMode] = useState<ExportTargetMode>("create");
  const [characterTargetId, setCharacterTargetId] = useState<number | null>(null);
  const [toPersona, setToPersona] = useState(false);
  const [personaMode, setPersonaMode] = useState<ExportTargetMode>("create");
  const [personaTargetId, setPersonaTargetId] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const { items: characterItems, loading: charactersLoading } = useCharacters();
  const { items: personaItems, loading: personasLoading } = usePersonas();
  const characterOptions = characterItems.map((c) => ({
    id: c.id,
    name: c.name,
    subtitle: c.tags.length > 0 ? c.tags.join(", ") : undefined,
    hasImage: c.hasImage,
  }));
  const personaOptions = personaItems.map((p) => ({
    id: p.id,
    name: p.name,
    subtitle: p.footnote ?? undefined,
    hasImage: p.hasImage,
  }));

  // В режиме "Обновить" нужен ещё и выбранный id — иначе кнопка была бы активна с незаполненным
  // выбором и submit тихо ничего бы не сделал с этой стороной (см. ветки handleSubmit ниже).
  const characterReady = !toCharacter || characterMode === "create" || characterTargetId !== null;
  const personaReady = !toPersona || personaMode === "create" || personaTargetId !== null;
  // Обновление меняет только промпт (см. handleSubmit) — имя/примечание из полей формы туда не
  // уходят, поэтому непустое имя обязательно, только если есть хотя бы одна цель именно на создание.
  const hasCreateTarget =
    (toCharacter && characterMode === "create") || (toPersona && personaMode === "create");
  const hasUpdateTarget =
    (toCharacter && characterMode === "update") || (toPersona && personaMode === "update");
  const canSubmit =
    (!hasCreateTarget || name.trim().length > 0) &&
    (toCharacter || toPersona) &&
    characterReady &&
    personaReady &&
    !submitting;

  // Пересобирает промпт под новый формат — переключатель меняет способ сборки, а не живёт рядом
  // с уже готовым текстом, поэтому перетирает поле напрямую (как выбор формата перед правкой,
  // а не синк с источником).
  const handleIncludeHeadersChange = (checked: boolean) => {
    setIncludeHeaders(checked);
    setPrompt(assembleExportPrompt(card.categories, checked));
  };

  // Персонаж и персона создаются/обновляются независимо друг от друга — успех одной стороны не
  // должен блокироваться отказом другой (например, лимит персон исчерпан, а персонаж создастся
  // нормально), поэтому каждая ветка ловит свою ошибку и копит сообщения отдельно, а не падает
  // через Promise.all. Обновление меняет ТОЛЬКО промпт — имя/примечание и остальные поля записи
  // (теги/сценарий/первые сообщения/фото) переносятся как есть из уже существующей записи (get*),
  // а не из полей формы (те относятся только к созданию новой записи): иначе PUT (full replace)
  // молча затёр бы их значениями формы/create-заглушками (tags: [], image: null, …).
  const handleSubmit = async () => {
    if (!canSubmit) return;
    if (hasUpdateTarget) {
      const confirmed = await confirmAction(
        "Промпт выбранной записи будет заменён текущим значением из формы — остальные поля (имя, примечание, фото и т.д.) останутся прежними.",
        { title: "Обновить промпт?", confirmText: "Обновить" },
      );
      if (!confirmed) return;
    }
    setSubmitting(true);
    const trimmedName = name.trim();
    const trimmedFootnote = footnote.trim() || null;
    const created: string[] = [];
    const failed: string[] = [];

    if (toCharacter) {
      try {
        if (characterMode === "update" && characterTargetId !== null) {
          const id = characterTargetId;
          const { character: existing } = await getCharacter(id);
          await updateCharacter(id, {
            name: existing.name,
            tags: existing.tags,
            footnote: existing.footnote,
            prompt,
            scenario: existing.scenario,
            firstMessages: existing.firstMessages,
            image: existing.image,
            imageFull: existing.imageFull,
          });
          created.push("Промпт персонажа обновлён");
        } else {
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
        }
      } catch (err) {
        console.error("Не удалось сохранить персонажа из карточки", err);
        failed.push(characterMode === "update" ? "Не удалось обновить промпт персонажа" : "Не удалось создать персонажа");
      }
    }

    if (toPersona) {
      try {
        if (personaMode === "update" && personaTargetId !== null) {
          const id = personaTargetId;
          const { persona: existing } = await getPersona(id);
          await updatePersona(id, {
            name: existing.name,
            footnote: existing.footnote,
            prompt,
            image: existing.image,
            imageFull: existing.imageFull,
          });
          created.push("Промпт персоны обновлён");
        } else {
          await createPersona({
            name: trimmedName,
            footnote: trimmedFootnote,
            prompt,
            image: null,
            imageFull: null,
          });
          created.push("Персона создана");
        }
      } catch (err) {
        console.error("Не удалось сохранить персону из карточки", err);
        failed.push(personaMode === "update" ? "Не удалось обновить промпт персоны" : "Не удалось создать персону");
      }
    }

    setSubmitting(false);
    if (created.length > 0) showToast({ type: "success", message: created.join(", ") });
    if (failed.length > 0) showToast({ type: "error", message: failed.join(", ") });
    // На список карточек уходим, только если хоть что-то удалось — иначе пользователь остаётся
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

        {/* См. коммент в ExportTargetSection — тот же приём: клик по всей строке переключает
            чекбокс, stopPropagation на обёртке (не на самом Checkbox) защищает от двойного
            срабатывания через label-forwarding клика. */}
        <Cell
          before={
            <div onClick={(e) => e.stopPropagation()}>
              <Checkbox
                checked={includeHeaders}
                onChange={(e) => handleIncludeHeadersChange(e.target.checked)}
              />
            </div>
          }
          onClick={() => handleIncludeHeadersChange(!includeHeaders)}
          subtitle="Каждый блок начинается со строки «# Название категории» — иначе только текст блоков подряд"
          multiline
        >
          Заголовки категорий в промпте
        </Cell>

        <PromptEditorField
          header="Финальный промпт"
          hint="Собран из включённых категорий карточки — можно отредактировать перед созданием."
          value={prompt}
          previewLines={6}
          onChange={setPrompt}
        />

        <ExportTargetSection
          label="Персонаж"
          checked={toCharacter}
          onCheckedChange={setToCharacter}
          mode={characterMode}
          onModeChange={setCharacterMode}
          modeAriaLabel="Режим для персонажа"
          modalTitle="Персонаж"
          placeholder="Выберите персонажа"
          emptyHint="Сначала создайте персонажа"
          icon={<User size={24} className="card-form__icon card-form__icon--hint" />}
          options={characterOptions}
          loading={charactersLoading}
          targetId={characterTargetId}
          onTargetChange={setCharacterTargetId}
          renderAvatar={(o) => <CharacterAvatar id={o.id} hasImage={o.hasImage} name={o.name} size={40} />}
        />

        <ExportTargetSection
          label="Персона"
          checked={toPersona}
          onCheckedChange={setToPersona}
          mode={personaMode}
          onModeChange={setPersonaMode}
          modeAriaLabel="Режим для персоны"
          modalTitle="Персона"
          placeholder="Выберите персону"
          emptyHint="Сначала создайте персону"
          icon={<Smile size={24} className="card-form__icon card-form__icon--hint" />}
          options={personaOptions}
          loading={personasLoading}
          targetId={personaTargetId}
          onTargetChange={setPersonaTargetId}
          renderAvatar={(o) => <PersonaAvatar id={o.id} hasImage={o.hasImage} name={o.name} size={40} />}
        />

        <SectionActions>
          <Button size="l" stretched disabled={!canSubmit} onClick={handleSubmit}>
            {submitting ? "Сохранение…" : hasUpdateTarget ? "Сохранить" : "Создать"}
          </Button>
        </SectionActions>
      </Section>
    </List>
  );
}

/**
 * Экран выгрузки карточки (/cards/:id/export): превращает готовую карточку в персонажа и/или
 * персону — как новую запись, так и обновление промпта уже существующей (ExportTargetSection на
 * каждую цель, выбор конкретной записи — ExportTargetPicker). Открывается только с уже сохранённой
 * карточки — GenerationSection в CardForm требует того же id, кнопка «Выгрузить» там задизейблена,
 * пока карточка не сохранена.
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
        <Text Component="div" className="cards-page__fullcenter">Карточка не найдена</Text>
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
