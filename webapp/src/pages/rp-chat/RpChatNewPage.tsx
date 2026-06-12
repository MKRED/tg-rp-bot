import { Button, Cell, List, Radio, Section, Spinner } from "@telegram-apps/telegram-ui";
import { motion } from "framer-motion";
import { useState } from "react";
import { ROUTES, chatViewPath } from "../../app/routes";
import { useTransitionNavigate } from "../../app/useTransitionNavigate";
import { PageTransition } from "../../shared/components/PageTransition";
import { CharacterAvatar, useCharacters } from "../../features/characters";
import { PersonaAvatar, usePersonas } from "../../features/personas";
import {
  presetSummary,
  usePresets,
} from "../../features/generation-presets";
import { createChat } from "../../features/rp-chat";
import "./rp-chat.css";

const SECTION_VARIANTS = {
  initial: { opacity: 0, y: 8 },
  animate: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.07, duration: 0.2, ease: "easeOut" as const },
  }),
};

/** Форма создания нового чата: выбор персонажа (обязательно), персоны, пресета ИИ. */
export function RpChatNewPage() {
  const navigate = useTransitionNavigate();

  const { items: characters, loading: charsLoading } = useCharacters();
  const { items: personas, loading: personasLoading } = usePersonas();
  const { items: presets, loading: presetsLoading } = usePresets();

  const [selectedCharId, setSelectedCharId] = useState<number | null>(null);
  const [selectedPersonaId, setSelectedPersonaId] = useState<number | null>(null);
  const [selectedPresetId, setSelectedPresetId] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!selectedCharId) return;
    setSubmitting(true);
    try {
      const chat = await createChat({
        characterId: selectedCharId,
        personaId: selectedPersonaId,
        presetId: selectedPresetId,
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
          {/* Секция выбора персонажа */}
          <motion.div custom={0} variants={SECTION_VARIANTS} initial="initial" animate="animate">
            <Section header="Персонаж" footer="Обязательно для создания чата">
              {charsLoading && (
                <div className="rp-chat-new-page__center">
                  <Spinner size="s" />
                </div>
              )}
              {!charsLoading && characters.length === 0 && (
                <Cell subtitle="Сначала создайте персонажа">Нет персонажей</Cell>
              )}
              {characters.map((c) => (
                <Cell
                  key={c.id}
                  before={
                    <CharacterAvatar id={c.id} hasImage={c.hasImage} name={c.name} size={40} />
                  }
                  after={<Radio checked={selectedCharId === c.id} readOnly />}
                  subtitle={c.tags.length > 0 ? c.tags.join(", ") : undefined}
                  onClick={() => setSelectedCharId(c.id)}
                >
                  {c.name}
                </Cell>
              ))}
            </Section>
          </motion.div>

          {/* Секция выбора персоны */}
          <motion.div custom={1} variants={SECTION_VARIANTS} initial="initial" animate="animate">
            <Section header="Персона" footer="Необязательно">
              <Cell
                after={<Radio checked={selectedPersonaId === null} readOnly />}
                onClick={() => setSelectedPersonaId(null)}
              >
                Без персоны
              </Cell>
              {personasLoading && (
                <div className="rp-chat-new-page__center">
                  <Spinner size="s" />
                </div>
              )}
              {personas.map((p) => (
                <Cell
                  key={p.id}
                  before={
                    <PersonaAvatar id={p.id} hasImage={p.hasImage} name={p.name} size={40} />
                  }
                  after={<Radio checked={selectedPersonaId === p.id} readOnly />}
                  subtitle={p.footnote ?? undefined}
                  onClick={() => setSelectedPersonaId(p.id)}
                >
                  {p.name}
                </Cell>
              ))}
            </Section>
          </motion.div>

          {/* Секция выбора пресета ИИ */}
          <motion.div custom={2} variants={SECTION_VARIANTS} initial="initial" animate="animate">
            <Section header="Настройки ИИ" footer="Необязательно">
              <Cell
                after={<Radio checked={selectedPresetId === null} readOnly />}
                onClick={() => setSelectedPresetId(null)}
              >
                По умолчанию
              </Cell>
              {presetsLoading && (
                <div className="rp-chat-new-page__center">
                  <Spinner size="s" />
                </div>
              )}
              {presets.map((p) => (
                <Cell
                  key={p.id}
                  after={<Radio checked={selectedPresetId === p.id} readOnly />}
                  subtitle={presetSummary(p)}
                  onClick={() => setSelectedPresetId(p.id)}
                >
                  {p.name}
                </Cell>
              ))}
            </Section>
          </motion.div>
        </List>

        <div className="rp-chat-new-page__submit">
          <Button
            size="l"
            stretched
            disabled={!selectedCharId || submitting}
            onClick={handleSubmit}
          >
            Начать чат
          </Button>
        </div>
      </div>
    </PageTransition>
  );
}
