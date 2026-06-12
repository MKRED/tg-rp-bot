import { Cell, List, Section, Spinner, Switch } from "@telegram-apps/telegram-ui";
import { motion, AnimatePresence } from "framer-motion";
import { Check, ChevronDown, Trash2 } from "lucide-react";
import { useState } from "react";
import { useParams } from "react-router-dom";
import { ROUTES } from "../../app/routes";
import { useTransitionNavigate } from "../../app/useTransitionNavigate";
import { PageTransition } from "../../shared/components/PageTransition";
import { deleteChat, useChatSettings } from "../../features/rp-chat";
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

export function RpChatSettingsPage() {
  const { id } = useParams<{ id: string }>();
  const chatId = Number(id);
  const navigate = useTransitionNavigate();
  const { settings, loading, update } = useChatSettings(chatId);
  const [deleting, setDeleting] = useState(false);
  const [langOpen, setLangOpen] = useState(false);
  const [scopeOpen, setScopeOpen] = useState(false);

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

  return (
    <PageTransition>
      <div className="rp-chat-settings-page">
        <List>
          <Section header="Перевод">
            {loading ? (
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
