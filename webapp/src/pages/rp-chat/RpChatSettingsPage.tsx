import { Cell, List, Section, Spinner, Switch } from "@telegram-apps/telegram-ui";
import { motion } from "framer-motion";
import { useParams } from "react-router-dom";
import { PageTransition } from "../../shared/components/PageTransition";
import { useChatSettings } from "../../features/rp-chat";
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
  { value: "all", label: "Всё" },
  { value: "assistant", label: "Только ответы ИИ" },
  { value: "user", label: "Только мои сообщения" },
];

export function RpChatSettingsPage() {
  const { id } = useParams<{ id: string }>();
  const chatId = Number(id);
  const { settings, loading, update } = useChatSettings(chatId);

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
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ ...ITEM_T, delay: 0.07 }}
                    >
                      <Cell subtitle="Язык перевода">
                        <select
                          style={{
                            background: "transparent",
                            border: "none",
                            color: "var(--tg-theme-text-color)",
                            font: "inherit",
                            cursor: "pointer",
                          }}
                          value={settings.translateTargetLang}
                          onChange={(e) => update({ translateTargetLang: e.target.value })}
                        >
                          {LANG_OPTIONS.map((o) => (
                            <option key={o.value} value={o.value}>{o.label}</option>
                          ))}
                        </select>
                      </Cell>
                    </motion.div>

                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ ...ITEM_T, delay: 0.14 }}
                    >
                      <Cell subtitle="На каких сообщениях показывать кнопку перевода">
                        <select
                          style={{
                            background: "transparent",
                            border: "none",
                            color: "var(--tg-theme-text-color)",
                            font: "inherit",
                            cursor: "pointer",
                          }}
                          value={settings.translateScope}
                          onChange={(e) =>
                            update({
                              translateScope: e.target.value as "all" | "assistant" | "user",
                            })
                          }
                        >
                          {SCOPE_OPTIONS.map((o) => (
                            <option key={o.value} value={o.value}>{o.label}</option>
                          ))}
                        </select>
                      </Cell>
                    </motion.div>
                  </>
                )}
              </>
            )}
          </Section>
        </List>
      </div>
    </PageTransition>
  );
}
