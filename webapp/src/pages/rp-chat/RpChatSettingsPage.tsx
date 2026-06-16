import { Cell, List, Section, Spinner, Switch } from "@telegram-apps/telegram-ui";
import { motion } from "framer-motion";
import { Bot, ChevronRight, Trash2, User } from "lucide-react";
import { useState } from "react";
import { useParams } from "react-router-dom";
import { ROUTES, characterEditPath, chatSettingsPath, personaEditPath, presetEditPath } from "../../app/routes";
import { useTransitionNavigate } from "../../app/useTransitionNavigate";
import { PageTransition } from "../../shared/components/PageTransition";
import { CharacterAvatar } from "../../features/characters/components/CharacterAvatar";
import { PersonaAvatar } from "../../features/personas/components/PersonaAvatar";
import { deleteChat, useChat, useChatSettings } from "../../features/rp-chat";
import { ExpandableSelect } from "../../features/rp-chat/components/ExpandableSelect";
import {
  AUTO_SCOPE_OPTIONS,
  LANG_OPTIONS,
  SCOPE_OPTIONS,
} from "../../features/rp-chat/lib/translate-options";
import { confirmAction } from "../../shared/telegram/confirm";
import "./rp-chat.css";

const ITEM_T = { duration: 0.2, ease: "easeOut" as const };

// Какой из выпадающих списков сейчас раскрыт — единое состояние, чтобы открытие одного
// автоматически закрывало остальные (раньше держалось тремя независимыми булевыми флагами).
type OpenSelect = "lang" | "scope" | "auto" | null;

export function RpChatSettingsPage() {
  const { id } = useParams<{ id: string }>();
  const chatId = Number(id);
  const navigate = useTransitionNavigate();
  const { chat, loading: chatLoading } = useChat(chatId);
  const { settings, loading: settingsLoading, update } = useChatSettings(chatId);
  const [deleting, setDeleting] = useState(false);
  const [openSelect, setOpenSelect] = useState<OpenSelect>(null);

  const toggle = (key: Exclude<OpenSelect, null>) =>
    setOpenSelect((cur) => (cur === key ? null : key));

  // returnTo передаётся в state при навигации к редактированию персонажа/персоны/пресета,
  // чтобы кнопка «Назад» Telegram вернула именно сюда (BackButtonBridge читает state.returnTo).
  const returnTo = chatSettingsPath(chatId);

  const handleDeleteChat = async () => {
    const ok = await confirmAction("Удалить чат? Все сообщения будут потеряны.", {
      title: "Удаление чата",
      confirmText: "Удалить",
    });
    if (!ok) return;
    setDeleting(true);
    try {
      await deleteChat(chatId);
      navigate(ROUTES.chats);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <PageTransition>
      <div className="rp-chat-settings-page">
        <List>
          {/* Секция с текущим персонажем, персоной и пресетом */}
          <Section header="Чат">
            {chatLoading ? (
              <div style={{ display: "flex", justifyContent: "center", padding: 16 }}>
                <Spinner size="m" />
              </div>
            ) : chat ? (
              <>
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ ...ITEM_T, delay: 0 }}
                >
                  <Cell
                    before={
                      <CharacterAvatar
                        id={chat.character.id}
                        hasImage={chat.character.hasImage}
                        name={chat.character.name}
                        size={40}
                      />
                    }
                    after={<ChevronRight size={16} style={{ color: "var(--tg-theme-hint-color)" }} />}
                    subtitle="Персонаж"
                    onClick={() => navigate(characterEditPath(chat.character.id), { state: { returnTo } })}
                  >
                    {chat.character.name}
                  </Cell>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ ...ITEM_T, delay: 0.07 }}
                >
                  <Cell
                    before={
                      chat.persona ? (
                        <PersonaAvatar
                          id={chat.persona.id}
                          hasImage={chat.persona.hasImage}
                          name={chat.persona.name}
                          size={40}
                        />
                      ) : (
                        <div className="rp-chat-settings-page__icon-avatar">
                          <User size={18} />
                        </div>
                      )
                    }
                    after={<ChevronRight size={16} style={{ color: "var(--tg-theme-hint-color)" }} />}
                    subtitle="Персона игрока"
                    onClick={() =>
                      chat.persona
                        ? navigate(personaEditPath(chat.persona.id), { state: { returnTo } })
                        : navigate(ROUTES.personas, { state: { returnTo } })
                    }
                  >
                    {chat.persona?.name ?? "Без персоны"}
                  </Cell>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ ...ITEM_T, delay: 0.14 }}
                >
                  <Cell
                    before={
                      <div className="rp-chat-settings-page__icon-avatar">
                        <Bot size={18} />
                      </div>
                    }
                    after={<ChevronRight size={16} style={{ color: "var(--tg-theme-hint-color)" }} />}
                    subtitle="Настройки ИИ"
                    onClick={() =>
                      chat.preset
                        ? navigate(presetEditPath(chat.preset.id), { state: { returnTo } })
                        : navigate(ROUTES.presets, { state: { returnTo } })
                    }
                  >
                    {chat.preset?.name ?? "Стандартные настройки"}
                  </Cell>
                </motion.div>
              </>
            ) : null}
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
                        onChange={(e) => update({ translateEnabled: e.target.checked })}
                      />
                    }
                    subtitle="Показывать кнопку перевода на сообщениях"
                  >
                    Перевод сообщений
                  </Cell>
                </motion.div>

                {settings.translateEnabled && (
                  <>
                    <ExpandableSelect
                      title="Язык"
                      subtitle="Язык перевода"
                      options={LANG_OPTIONS}
                      value={settings.translateTargetLang}
                      onChange={(value) => { update({ translateTargetLang: value }); setOpenSelect(null); }}
                      open={openSelect === "lang"}
                      onToggle={() => toggle("lang")}
                      delay={0.07}
                    />

                    <ExpandableSelect
                      title="Показывать"
                      subtitle="На каких сообщениях показывать кнопку перевода"
                      options={SCOPE_OPTIONS}
                      value={settings.translateScope}
                      onChange={(value) => { update({ translateScope: value }); setOpenSelect(null); }}
                      open={openSelect === "scope"}
                      onToggle={() => toggle("scope")}
                      delay={0.14}
                    />

                    <ExpandableSelect
                      title="Авто-перевод"
                      subtitle="Переводить входящие сообщения сразу"
                      options={AUTO_SCOPE_OPTIONS}
                      value={settings.autoTranslateScope}
                      onChange={(value) => { update({ autoTranslateScope: value }); setOpenSelect(null); }}
                      open={openSelect === "auto"}
                      onToggle={() => toggle("auto")}
                      delay={0.21}
                    />
                  </>
                )}
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
                onClick={handleDeleteChat}
                style={{ color: "#e53935", cursor: deleting ? "default" : "pointer", opacity: deleting ? 0.5 : 1 }}
              >
                Удалить чат
              </Cell>
            </motion.div>
          </Section>
        </List>
      </div>
    </PageTransition>
  );
}
