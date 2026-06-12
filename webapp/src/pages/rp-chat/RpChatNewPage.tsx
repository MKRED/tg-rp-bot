import { Button, Cell, List, Modal, Section, Spinner } from "@telegram-apps/telegram-ui";
import { ChevronRight, SlidersHorizontal, Smile, User } from "lucide-react";
import { motion } from "framer-motion";
import { useState } from "react";
import { ROUTES, chatViewPath } from "../../app/routes";
import { useTransitionNavigate } from "../../app/useTransitionNavigate";
import { PageTransition } from "../../shared/components/PageTransition";
import { CharacterAvatar, useCharacters } from "../../features/characters";
import { PersonaAvatar, usePersonas } from "../../features/personas";
import { presetSummary, usePresets } from "../../features/generation-presets";
import { createChat } from "../../features/rp-chat";
import "./rp-chat.css";

// null = ещё не выбрано (блокирует сабмит); "none"/"default" = явный выбор «без»
type PersonaChoice = number | "none" | null;
type PresetChoice = number | "default" | null;

const ITEM_TRANSITION = { duration: 0.2, ease: "easeOut" as const };

/** Форма создания нового чата: три обязательных поля — персонаж, персона, пресет ИИ. */
export function RpChatNewPage() {
  const navigate = useTransitionNavigate();

  const { items: characters, loading: charsLoading } = useCharacters();
  const { items: personas, loading: personasLoading } = usePersonas();
  const { items: presets, loading: presetsLoading } = usePresets();

  const [charId, setCharId] = useState<number | null>(null);
  const [personaChoice, setPersonaChoice] = useState<PersonaChoice>(null);
  const [presetChoice, setPresetChoice] = useState<PresetChoice>(null);
  const [submitting, setSubmitting] = useState(false);

  const [charOpen, setCharOpen] = useState(false);
  const [personaOpen, setPersonaOpen] = useState(false);
  const [presetOpen, setPresetOpen] = useState(false);

  const selectedChar = characters.find((c) => c.id === charId) ?? null;
  const selectedPersona =
    typeof personaChoice === "number"
      ? (personas.find((p) => p.id === personaChoice) ?? null)
      : null;
  const selectedPreset =
    typeof presetChoice === "number"
      ? (presets.find((p) => p.id === presetChoice) ?? null)
      : null;

  const canSubmit =
    charId !== null && personaChoice !== null && presetChoice !== null && !submitting;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const chat = await createChat({
        characterId: charId!,
        personaId: typeof personaChoice === "number" ? personaChoice : null,
        presetId: typeof presetChoice === "number" ? presetChoice : null,
      });
      navigate(chatViewPath(chat.id));
    } catch {
      // Бэкенд ещё не реализован — возвращаемся на хаб
      navigate(ROUTES.chats);
    } finally {
      setSubmitting(false);
    }
  };

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

            {/* Персона */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...ITEM_TRANSITION, delay: 0.07 }}
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
                  personaChoice === null
                    ? "Обязательно"
                    : personaChoice === "none"
                      ? "Играть без персоны"
                      : (selectedPersona?.footnote ?? "Персона")
                }
                onClick={() => setPersonaOpen(true)}
              >
                {personaChoice === null
                  ? "Выберите персону"
                  : personaChoice === "none"
                    ? "Без персоны"
                    : (selectedPersona?.name ?? "Персона")}
              </Cell>
            </motion.div>

            {/* Пресет ИИ */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...ITEM_TRANSITION, delay: 0.14 }}
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
                    : presetChoice === "default"
                      ? "Стандартные параметры"
                      : (selectedPreset ? presetSummary(selectedPreset) : "Пресет ИИ")
                }
                onClick={() => setPresetOpen(true)}
              >
                {presetChoice === null
                  ? "Выберите настройки ИИ"
                  : presetChoice === "default"
                    ? "По умолчанию"
                    : (selectedPreset?.name ?? "Пресет")}
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

        {/* Модал выбора персоны */}
        <Modal
          open={personaOpen}
          onOpenChange={setPersonaOpen}
          header={<Modal.Header>Персона</Modal.Header>}
        >
          <List>
            <Cell
              before={<Smile size={24} className="rp-chat-new-page__icon rp-chat-new-page__icon--hint" />}
              subtitle="Играть без персоны"
              onClick={() => {
                setPersonaChoice("none");
                setPersonaOpen(false);
              }}
            >
              Без персоны
            </Cell>
            {personasLoading && (
              <div className="rp-chat-new-page__center">
                <Spinner size="m" />
              </div>
            )}
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
          <List>
            <Cell
              before={<SlidersHorizontal size={24} className="rp-chat-new-page__icon rp-chat-new-page__icon--hint" />}
              subtitle="Стандартные параметры генерации"
              onClick={() => {
                setPresetChoice("default");
                setPresetOpen(false);
              }}
            >
              По умолчанию
            </Cell>
            {presetsLoading && (
              <div className="rp-chat-new-page__center">
                <Spinner size="m" />
              </div>
            )}
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
