import { Button, Cell, List, Modal, Section, Spinner } from "@telegram-apps/telegram-ui";
import { ChevronRight, MessageSquareText, SlidersHorizontal, Smile, User } from "lucide-react";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { ROUTES, chatViewPath } from "../../app/routes";
import { useTransitionNavigate } from "../../app/useTransitionNavigate";
import { PageTransition } from "../../shared/components/PageTransition";
import { CharacterAvatar, useCharacters, useCharacter } from "../../features/characters";
import { PersonaAvatar, usePersonas } from "../../features/personas";
import { presetSummary, usePresets } from "../../features/generation-presets";
import { createChat } from "../../features/rp-chat";
import "./rp-chat.css";

// null = ещё не выбрано (блокирует сабмит). Персона и пресет обязательны.
type PersonaChoice = number | null;
type PresetChoice = number | null;
// Выбор приветствия: индекс в firstMessages, "random" = случайное, null = у персонажа нет приветствий.
type GreetingChoice = number | "random" | null;

const ITEM_TRANSITION = { duration: 0.2, ease: "easeOut" as const };

/** Усекает длинный текст приветствия для превью в ячейке/модале. */
const truncate = (s: string, n = 60): string =>
  s.length > n ? `${s.slice(0, n).trimEnd()}…` : s;

/** Форма создания нового чата: персонаж, приветствие, персона, пресет ИИ. */
export function RpChatNewPage() {
  const navigate = useTransitionNavigate();

  const { items: characters, loading: charsLoading } = useCharacters();
  const { items: personas, loading: personasLoading } = usePersonas();
  const { items: presets, loading: presetsLoading } = usePresets();

  const [charId, setCharId] = useState<number | null>(null);
  const [personaChoice, setPersonaChoice] = useState<PersonaChoice>(null);
  const [presetChoice, setPresetChoice] = useState<PresetChoice>(null);
  const [greetingChoice, setGreetingChoice] = useState<GreetingChoice>(null);
  const [submitting, setSubmitting] = useState(false);

  const [charOpen, setCharOpen] = useState(false);
  const [personaOpen, setPersonaOpen] = useState(false);
  const [presetOpen, setPresetOpen] = useState(false);
  const [greetingOpen, setGreetingOpen] = useState(false);

  // Полный выбранный персонаж — ради firstMessages (строка списка их не отдаёт). Перезапрос при смене.
  const { character: selectedCharFull, loading: charFullLoading } = useCharacter(charId ?? undefined);
  const firstMessages = selectedCharFull?.firstMessages ?? [];

  // При смене персонажа сбрасываем выбор приветствия на дефолт (первое), либо null если их нет.
  useEffect(() => {
    setGreetingChoice(firstMessages.length >= 1 ? 0 : null);
  }, [selectedCharFull?.id, firstMessages.length]);

  const selectedChar = characters.find((c) => c.id === charId) ?? null;
  const selectedPersona = personas.find((p) => p.id === personaChoice) ?? null;
  const selectedPreset = presets.find((p) => p.id === presetChoice) ?? null;

  const canSubmit =
    charId !== null && personaChoice !== null && presetChoice !== null && !submitting;

  const handleSubmit = async () => {
    if (!canSubmit || charId === null || personaChoice === null || presetChoice === null) return;
    setSubmitting(true);
    try {
      const count = firstMessages.length;
      // Разрешаем выбор в конкретный индекс: "random" → случайный (только если есть из чего выбирать),
      // null (нет приветствий) → 0 (сервер вернёт firstMessages[0] ?? null, т.е. чат без стартового).
      const firstMessageIndex =
        greetingChoice === "random" && count > 0
          ? Math.floor(Math.random() * count)
          : typeof greetingChoice === "number"
            ? greetingChoice
            : 0;
      const chat = await createChat({
        characterId: charId,
        personaId: personaChoice,
        presetId: presetChoice,
        firstMessageIndex,
      });
      navigate(chatViewPath(chat.id));
    } catch (err) {
      // Создание не удалось (сеть/валидация) — логируем и возвращаемся на хаб чатов
      console.error("Не удалось создать чат", err);
      navigate(ROUTES.chats);
    } finally {
      setSubmitting(false);
    }
  };

  // Подпись и заголовок ячейки приветствия для текущего выбора.
  const hasGreetings = firstMessages.length >= 1;
  const greetingTitle =
    greetingChoice === "random"
      ? "Случайное"
      : typeof greetingChoice === "number"
        ? truncate(firstMessages[greetingChoice] ?? "")
        : "Без приветствия";
  const greetingSubtitle =
    greetingChoice === "random"
      ? "Будет выбрано случайно"
      : typeof greetingChoice === "number"
        ? `Приветствие ${greetingChoice + 1} из ${firstMessages.length}`
        : "У персонажа нет приветствия — чат начнётся пустым";

  return (
    <PageTransition>
      <div className="rp-chat-new-page">
        <List>
          <Section header="Новый чат">
            {/* Персонаж */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...ITEM_TRANSITION, delay: 0 }}
            >
              <Cell
                before={
                  selectedChar ? (
                    <CharacterAvatar
                      id={selectedChar.id}
                      hasImage={selectedChar.hasImage}
                      name={selectedChar.name}
                      size={40}
                    />
                  ) : (
                    <User size={24} className="rp-chat-new-page__icon rp-chat-new-page__icon--hint" />
                  )
                }
                after={<ChevronRight size={20} className="rp-chat-new-page__chevron" />}
                subtitle={
                  selectedChar
                    ? selectedChar.tags.length > 0
                      ? selectedChar.tags.join(", ")
                      : "Персонаж"
                    : "Обязательно"
                }
                onClick={() => setCharOpen(true)}
              >
                {selectedChar?.name ?? "Выберите персонажа"}
              </Cell>
            </motion.div>

            {/* Приветствие — видно только после выбора персонажа */}
            {selectedChar && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ ...ITEM_TRANSITION, delay: 0.05 }}
              >
                <Cell
                  before={
                    <MessageSquareText
                      size={24}
                      className={`rp-chat-new-page__icon${hasGreetings || charFullLoading ? "" : " rp-chat-new-page__icon--hint"}`}
                    />
                  }
                  after={
                    hasGreetings && !charFullLoading ? (
                      <ChevronRight size={20} className="rp-chat-new-page__chevron" />
                    ) : undefined
                  }
                  // Пока грузим полного персонажа — нейтральное «Загрузка…», чтобы не мигала ложная
                  // подсказка «нет приветствия» (firstMessages подтянутся только после fetch).
                  subtitle={charFullLoading ? "Загрузка…" : greetingSubtitle}
                  multiline
                  // Кликабельна только когда персонаж загружен и у него есть приветствия
                  onClick={hasGreetings && !charFullLoading ? () => setGreetingOpen(true) : undefined}
                >
                  {charFullLoading ? "Приветствие" : greetingTitle}
                </Cell>
              </motion.div>
            )}

            {/* Персона */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...ITEM_TRANSITION, delay: 0.1 }}
            >
              <Cell
                before={
                  selectedPersona ? (
                    <PersonaAvatar
                      id={selectedPersona.id}
                      hasImage={selectedPersona.hasImage}
                      name={selectedPersona.name}
                      size={40}
                    />
                  ) : (
                    <Smile
                      size={24}
                      className={`rp-chat-new-page__icon${personaChoice === null ? " rp-chat-new-page__icon--hint" : ""}`}
                    />
                  )
                }
                after={<ChevronRight size={20} className="rp-chat-new-page__chevron" />}
                subtitle={
                  personaChoice === null ? "Обязательно" : (selectedPersona?.footnote ?? "Персона")
                }
                onClick={() => setPersonaOpen(true)}
              >
                {selectedPersona?.name ?? "Выберите персону"}
              </Cell>
            </motion.div>

            {/* Пресет ИИ */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...ITEM_TRANSITION, delay: 0.15 }}
            >
              <Cell
                before={
                  <SlidersHorizontal
                    size={24}
                    className={`rp-chat-new-page__icon${presetChoice === null ? " rp-chat-new-page__icon--hint" : ""}`}
                  />
                }
                after={<ChevronRight size={20} className="rp-chat-new-page__chevron" />}
                subtitle={
                  presetChoice === null
                    ? "Обязательно"
                    : (selectedPreset ? presetSummary(selectedPreset) : "Пресет ИИ")
                }
                onClick={() => setPresetOpen(true)}
              >
                {selectedPreset?.name ?? "Выберите настройки ИИ"}
              </Cell>
            </motion.div>
          </Section>
        </List>

        <motion.div
          className="rp-chat-new-page__submit"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...ITEM_TRANSITION, delay: 0.21 }}
        >
          <Button size="l" stretched disabled={!canSubmit} onClick={handleSubmit}>
            {submitting ? <Spinner size="s" /> : "Начать чат"}
          </Button>
        </motion.div>

        {/* Модал выбора персонажа */}
        <Modal
          open={charOpen}
          onOpenChange={setCharOpen}
          header={<Modal.Header>Персонаж</Modal.Header>}
        >
          {charsLoading && (
            <div className="rp-chat-new-page__center">
              <Spinner size="m" />
            </div>
          )}
          {!charsLoading && characters.length === 0 && (
            <Cell subtitle="Сначала создайте персонажа">Нет персонажей</Cell>
          )}
          <List>
            {characters.map((c) => (
              <Cell
                key={c.id}
                before={
                  <CharacterAvatar id={c.id} hasImage={c.hasImage} name={c.name} size={40} />
                }
                subtitle={c.tags.length > 0 ? c.tags.join(", ") : undefined}
                onClick={() => {
                  setCharId(c.id);
                  setCharOpen(false);
                }}
              >
                {c.name}
              </Cell>
            ))}
          </List>
        </Modal>

        {/* Модал выбора приветствия */}
        <Modal
          open={greetingOpen}
          onOpenChange={setGreetingOpen}
          header={<Modal.Header>Приветствие</Modal.Header>}
        >
          <List>
            {/* «Случайное» имеет смысл только при 2+ вариантах */}
            {firstMessages.length >= 2 && (
              <Cell
                before={<MessageSquareText size={24} className="rp-chat-new-page__icon" />}
                subtitle="Выбрать одно из приветствий наугад"
                onClick={() => {
                  setGreetingChoice("random");
                  setGreetingOpen(false);
                }}
              >
                Случайное
              </Cell>
            )}
            {firstMessages.map((msg, i) => (
              <Cell
                key={`${charId}-${i}`}
                subtitle={`Приветствие ${i + 1}`}
                multiline
                onClick={() => {
                  setGreetingChoice(i);
                  setGreetingOpen(false);
                }}
              >
                {truncate(msg, 120)}
              </Cell>
            ))}
          </List>
        </Modal>

        {/* Модал выбора персоны */}
        <Modal
          open={personaOpen}
          onOpenChange={setPersonaOpen}
          header={<Modal.Header>Персона</Modal.Header>}
        >
          {personasLoading && (
            <div className="rp-chat-new-page__center">
              <Spinner size="m" />
            </div>
          )}
          {!personasLoading && personas.length === 0 && (
            <Cell subtitle="Сначала создайте персону">Нет персон</Cell>
          )}
          <List>
            {personas.map((p) => (
              <Cell
                key={p.id}
                before={
                  <PersonaAvatar id={p.id} hasImage={p.hasImage} name={p.name} size={40} />
                }
                subtitle={p.footnote ?? undefined}
                onClick={() => {
                  setPersonaChoice(p.id);
                  setPersonaOpen(false);
                }}
              >
                {p.name}
              </Cell>
            ))}
          </List>
        </Modal>

        {/* Модал выбора пресета ИИ */}
        <Modal
          open={presetOpen}
          onOpenChange={setPresetOpen}
          header={<Modal.Header>Настройки ИИ</Modal.Header>}
        >
          {presetsLoading && (
            <div className="rp-chat-new-page__center">
              <Spinner size="m" />
            </div>
          )}
          {!presetsLoading && presets.length === 0 && (
            <Cell subtitle="Сначала создайте пресет">Нет пресетов</Cell>
          )}
          <List>
            {presets.map((p) => (
              <Cell
                key={p.id}
                subtitle={presetSummary(p)}
                onClick={() => {
                  setPresetChoice(p.id);
                  setPresetOpen(false);
                }}
              >
                {p.name}
              </Cell>
            ))}
          </List>
        </Modal>
      </div>
    </PageTransition>
  );
}
