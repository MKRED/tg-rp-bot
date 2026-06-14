import { Cell, List, Section, Spinner, Switch } from "@telegram-apps/telegram-ui";
import { motion, AnimatePresence } from "framer-motion";
import { Bot, Check, ChevronDown, ChevronRight, Trash2, User } from "lucide-react";
import { useState } from "react";
import { useParams } from "react-router-dom";
import { ROUTES, characterEditPath, chatSettingsPath, personaEditPath, presetEditPath } from "../../app/routes";
import { useTransitionNavigate } from "../../app/useTransitionNavigate";
import { PageTransition } from "../../shared/components/PageTransition";
import { CharacterAvatar } from "../../features/characters/components/CharacterAvatar";
import { PersonaAvatar } from "../../features/personas/components/PersonaAvatar";
import { deleteChat, useChat, useChatSettings } from "../../features/rp-chat";
import { confirmAction } from "../../shared/telegram/confirm";
import "./rp-chat.css";

const ITEM_T = { duration: 0.2, ease: "easeOut" as const };

const LANG_OPTIONS = [
  { value: "ru", label: "Русский" },
  { value: "en", label: "English" },
  { value: "de", label: "Deutsch" },
  { value: "ja", label: "日本語" },
  { value: "zh", label: "中文" },
  { value: "fr", label: "Français" },
  { value: "es", label: "Español" },
];

const SCOPE_OPTIONS: { value: "all" | "assistant" | "user"; label: string }[] = [
  { value: "all", label: "Все сообщения" },
  { value: "assistant", label: "Только ответы ИИ" },
  { value: "user", label: "Только мои сообщения" },
];

const AUTO_SCOPE_OPTIONS: { value: "none" | "all" | "assistant" | "user"; label: string }[] = [
  { value: "none", label: "Отключён" },
  { value: "all", label: "Все сообщения" },
  { value: "assistant", label: "Ответы ИИ" },
  { value: "user", label: "Мои сообщения" },
];

export function RpChatSettingsPage() {
  const { id } = useParams<{ id: string }>();
  const chatId = Number(id);
  const navigate = useTransitionNavigate();
  const { chat, loading: chatLoading } = useChat(chatId);
  const { settings, loading: settingsLoading, update } = useChatSettings(chatId);
  const [deleting, setDeleting] = useState(false);
  const [langOpen, setLangOpen] = useState(false);
  const [scopeOpen, setScopeOpen] = useState(false);
  const [autoScopeOpen, setAutoScopeOpen] = useState(false);

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

  const currentLangLabel = LANG_OPTIONS.find((o) => o.value === settings.translateTargetLang)?.label ?? "";
  const currentScopeLabel = SCOPE_OPTIONS.find((o) => o.value === settings.translateScope)?.label ?? "";
  const currentAutoScopeLabel = AUTO_SCOPE_OPTIONS.find((o) => o.value === settings.autoTranslateScope)?.label ?? "";

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
                    {/* Язык перевода — раскрывающийся список */}
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ ...ITEM_T, delay: 0.07 }}
                    >
                      <Cell
                        onClick={() => { setLangOpen((v) => !v); setScopeOpen(false); }}
                        after={
                          <div style={{ display: "flex", alignItems: "center", gap: 4, color: "var(--tg-theme-hint-color)" }}>
                            <span style={{ fontSize: 14 }}>{currentLangLabel}</span>
                            <ChevronDown
                              size={16}
                              style={{
                                transition: "transform 0.2s",
                                transform: langOpen ? "rotate(180deg)" : "rotate(0deg)",
                              }}
                            />
                          </div>
                        }
                        subtitle="Язык перевода"
                      >
                        Язык
                      </Cell>
                    </motion.div>

                    <AnimatePresence>
                      {langOpen && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={ITEM_T}
                          style={{ overflow: "hidden" }}
                        >
                          {LANG_OPTIONS.map((o) => (
                            <Cell
                              key={o.value}
                              onClick={() => { update({ translateTargetLang: o.value }); setLangOpen(false); }}
                              after={settings.translateTargetLang === o.value ? <Check size={16} /> : null}
                              style={{ paddingLeft: 32 }}
                            >
                              {o.label}
                            </Cell>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* На каких сообщениях показывать кнопку */}
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ ...ITEM_T, delay: 0.14 }}
                    >
                      <Cell
                        onClick={() => { setScopeOpen((v) => !v); setLangOpen(false); }}
                        after={
                          <div style={{ display: "flex", alignItems: "center", gap: 4, color: "var(--tg-theme-hint-color)" }}>
                            <span style={{ fontSize: 14 }}>{currentScopeLabel}</span>
                            <ChevronDown
                              size={16}
                              style={{
                                transition: "transform 0.2s",
                                transform: scopeOpen ? "rotate(180deg)" : "rotate(0deg)",
                              }}
                            />
                          </div>
                        }
                        subtitle="На каких сообщениях показывать кнопку перевода"
                      >
                        Показывать
                      </Cell>
                    </motion.div>

                    <AnimatePresence>
                      {scopeOpen && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={ITEM_T}
                          style={{ overflow: "hidden" }}
                        >
                          {SCOPE_OPTIONS.map((o) => (
                            <Cell
                              key={o.value}
                              onClick={() => { update({ translateScope: o.value }); setScopeOpen(false); }}
                              after={settings.translateScope === o.value ? <Check size={16} /> : null}
                              style={{ paddingLeft: 32 }}
                            >
                              {o.label}
                            </Cell>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Авто-перевод новых сообщений */}
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ ...ITEM_T, delay: 0.21 }}
                    >
                      <Cell
                        onClick={() => { setAutoScopeOpen((v) => !v); setLangOpen(false); setScopeOpen(false); }}
                        after={
                          <div style={{ display: "flex", alignItems: "center", gap: 4, color: "var(--tg-theme-hint-color)" }}>
                            <span style={{ fontSize: 14 }}>{currentAutoScopeLabel}</span>
                            <ChevronDown
                              size={16}
                              style={{
                                transition: "transform 0.2s",
                                transform: autoScopeOpen ? "rotate(180deg)" : "rotate(0deg)",
                              }}
                            />
                          </div>
                        }
                        subtitle="Переводить входящие сообщения сразу"
                      >
                        Авто-перевод
                      </Cell>
                    </motion.div>

                    <AnimatePresence>
                      {autoScopeOpen && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={ITEM_T}
                          style={{ overflow: "hidden" }}
                        >
                          {AUTO_SCOPE_OPTIONS.map((o) => (
                            <Cell
                              key={o.value}
                              onClick={() => { update({ autoTranslateScope: o.value }); setAutoScopeOpen(false); }}
                              after={settings.autoTranslateScope === o.value ? <Check size={16} /> : null}
                              style={{ paddingLeft: 32 }}
                            >
                              {o.label}
                            </Cell>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
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
