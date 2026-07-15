import { Cell, List, Section, Spinner, Switch } from "@telegram-apps/telegram-ui";
import { motion } from "framer-motion";
import { Bot, ChevronRight, Eraser, FileText, Trash2, User } from "lucide-react";
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import {
  ROUTES,
  characterEditPath,
  chatSettingsPath,
  personaEditPath,
  presetEditPath,
  rpTemplateEditPath,
} from "../../app/routes";
import { useTransitionNavigate } from "../../app/useTransitionNavigate";
import { HintedInput } from "../../shared/components/HintedInput";
import { PageTransition } from "../../shared/components/PageTransition";
import { CharacterAvatar } from "../../features/characters/components/CharacterAvatar";
import { PersonaAvatar } from "../../features/personas/components/PersonaAvatar";
import { deleteChat, renameChat, useChat, useChatSettings, useChatStats } from "../../features/rp-chat";
import { ExpandableSelect } from "../../shared/components/ExpandableSelect";
import { SegmentedToggle } from "../../shared/components/SegmentedToggle";
import { TokenBudgetBar } from "../../shared/components/TokenBudgetBar";
import {
  AUTO_SCOPE_OPTIONS,
  LANG_OPTIONS,
  METHOD_OPTIONS,
  SCOPE_OPTIONS,
} from "../../features/rp-chat/lib/translate-options";
import { confirmAction } from "../../shared/telegram/confirm";
import "./rp-chat.css";

const ITEM_T = { duration: 0.2, ease: "easeOut" as const };

// Токены — оценка (~), показываем с разделителями разрядов для читаемости.
const fmtTokens = (n: number) => `~${n.toLocaleString("ru-RU")}`;

// Какой из выпадающих списков сейчас раскрыт — единое состояние, чтобы открытие одного
// автоматически закрывало остальные (раньше держалось тремя независимыми булевыми флагами).
type OpenSelect = "lang" | "scope" | "auto" | null;

export function RpChatSettingsPage() {
  const { id } = useParams<{ id: string }>();
  const chatId = Number(id);
  const navigate = useTransitionNavigate();
  const { chat, loading: chatLoading, setChat } = useChat(chatId);
  const { settings, loading: settingsLoading, update } = useChatSettings(chatId);
  const { stats, loading: statsLoading, clearing, clearVariants } = useChatStats(chatId);
  const [deleting, setDeleting] = useState(false);
  const [openSelect, setOpenSelect] = useState<OpenSelect>(null);
  // Локальное поле названия чата: правится свободно, сохраняется на blur.
  const [title, setTitle] = useState("");

  // Подхватываем сохранённое название, когда чат загрузился или сменился.
  useEffect(() => {
    setTitle(chat?.title ?? "");
  }, [chat?.id, chat?.title]);

  // Сохраняем название на blur: пустая строка очищает (сервер вернёт title = null).
  const handleTitleBlur = async () => {
    if (!chat) return;
    const next = title.trim();
    if (next === (chat.title ?? "")) return; // без изменений — не дёргаем API
    try {
      const saved = await renameChat(chatId, next);
      setChat((prev) => (prev ? { ...prev, title: saved } : prev));
      setTitle(saved ?? "");
    } catch (err) {
      // При ошибке возвращаем поле к сохранённому значению, чтобы UI не врал
      console.error("Failed to rename chat", err);
      setTitle(chat.title ?? "");
    }
  };

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

  const handleClearVariants = async () => {
    if (clearing || stats.impersonationCount === 0) return;
    const ok = await confirmAction(
      "Очистить все сохранённые варианты реплик? Их можно будет сгенерировать заново.",
      { title: "Очистка вариантов", confirmText: "Очистить" },
    );
    if (!ok) return;
    await clearVariants();
  };

  return (
    <PageTransition>
      <div className="rp-chat-settings-page">
        <List>
          {/* Название чата: пусто → в списке и шапке показываем имя персонажа.
              section-blend-inputs убирает «коробку»-фон у FormInput, чтобы поле сливалось
              с карточкой секции. */}
          {chat && (
            <Section className="section-blend-inputs" header="Название">
              <HintedInput
                placeholder={chat.character.name}
                hint="Оставьте пустым, чтобы показывать имя персонажа"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onBlur={handleTitleBlur}
              />
            </Section>
          )}

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
                        <FileText size={18} />
                      </div>
                    }
                    after={<ChevronRight size={16} style={{ color: "var(--tg-theme-hint-color)" }} />}
                    subtitle="RP-шаблон"
                    onClick={() =>
                      chat.template
                        ? navigate(rpTemplateEditPath(chat.template.id), { state: { returnTo } })
                        : navigate(ROUTES.rpTemplates, { state: { returnTo } })
                    }
                  >
                    {chat.template?.name ?? "Без шаблона"}
                  </Cell>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ ...ITEM_T, delay: 0.21 }}
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
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ ...ITEM_T, delay: 0.07 }}
                    >
                      <Cell
                        subtitle="Google Translate или запрос к ИИ"
                        after={
                          <SegmentedToggle
                            options={METHOD_OPTIONS}
                            value={settings.translateMethod}
                            onChange={(value) => update({ translateMethod: value })}
                          />
                        }
                      >
                        Метод перевода
                      </Cell>
                    </motion.div>

                    <ExpandableSelect
                      title="Язык"
                      subtitle="Язык перевода"
                      options={LANG_OPTIONS}
                      value={settings.translateTargetLang}
                      onChange={(value) => { update({ translateTargetLang: value }); setOpenSelect(null); }}
                      open={openSelect === "lang"}
                      onToggle={() => toggle("lang")}
                      delay={0.14}
                    />

                    <ExpandableSelect
                      title="Показывать"
                      subtitle="На каких сообщениях показывать кнопку перевода"
                      options={SCOPE_OPTIONS}
                      value={settings.translateScope}
                      onChange={(value) => { update({ translateScope: value }); setOpenSelect(null); }}
                      open={openSelect === "scope"}
                      onToggle={() => toggle("scope")}
                      delay={0.21}
                    />

                    <ExpandableSelect
                      title="Авто-перевод"
                      subtitle="Переводить входящие сообщения сразу"
                      options={AUTO_SCOPE_OPTIONS}
                      value={settings.autoTranslateScope}
                      onChange={(value) => { update({ autoTranslateScope: value }); setOpenSelect(null); }}
                      open={openSelect === "auto"}
                      onToggle={() => toggle("auto")}
                      delay={0.28}
                    />
                  </>
                )}
              </>
            )}
          </Section>

          <Section header="Статистика">
            {statsLoading ? (
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
                    after={<span style={{ color: "var(--tg-theme-hint-color)" }}>{fmtTokens(stats.tokensTotal)}</span>}
                    subtitle="Токенов в сообщениях всех веток"
                  >
                    Весь чат
                  </Cell>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ ...ITEM_T, delay: 0.07 }}
                >
                  <Cell
                    after={<span style={{ color: "var(--tg-theme-hint-color)" }}>{fmtTokens(stats.tokensActiveBranch)}</span>}
                    subtitle="Токенов в сообщениях текущей ветки"
                  >
                    Активная ветка
                  </Cell>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ ...ITEM_T, delay: 0.14 }}
                >
                  <Cell subtitle="Полный запрос к ИИ: активная ветка + промпты">
                    Запрос с промптами
                  </Cell>
                  {/* Полоса «использовано / лимит контекста»; при безграничном пресете лимит = ∞ */}
                  <TokenBudgetBar used={stats.tokensPrompt} limit={stats.contextLimit} />
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ ...ITEM_T, delay: 0.21 }}
                >
                  <Cell
                    before={<Eraser size={20} style={{ color: "var(--tg-theme-hint-color)" }} />}
                    after={<span style={{ color: "var(--tg-theme-hint-color)" }}>{stats.impersonationCount}</span>}
                    subtitle="Сгенерированные варианты реплик игрока"
                    onClick={handleClearVariants}
                    style={{
                      cursor: clearing || stats.impersonationCount === 0 ? "default" : "pointer",
                      opacity: clearing || stats.impersonationCount === 0 ? 0.5 : 1,
                    }}
                  >
                    Очистить сохранённые варианты
                  </Cell>
                </motion.div>
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
