import { MessagesSquare } from "lucide-react";
import { useState } from "react";
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
import { AppPage } from "../../shared/components/AppPage";
import { DeleteButton } from "../../shared/components/DeleteButton";
import { EmptyState } from "../../shared/components/EmptyState";
import { confirmAction } from "../../shared/telegram/confirm";
import { useToast } from "../../shared/toast";
import {
  ChatLinksCard,
  ChatStatsCard,
  ChatTitleCard,
  ChatTranslateCard,
  deleteChat,
  useChat,
  useChatSettings,
  useChatStats,
  type ChatLinkTarget,
  type ChatSettings,
} from "../../features/rp-chat";

/** Куда ведёт строка «Состава чата»: редактирование записи, а если её удалили — список. */
function linkPath(target: ChatLinkTarget): string {
  switch (target.kind) {
    case "character":
      return characterEditPath(target.id);
    case "persona":
      return target.id !== null ? personaEditPath(target.id) : ROUTES.personas;
    case "template":
      return target.id !== null ? rpTemplateEditPath(target.id) : ROUTES.rpTemplates;
    case "preset":
      return target.id !== null ? presetEditPath(target.id) : ROUTES.presets;
  }
}

/** Настройки чата: название, из чего собран, перевод, статистика, удаление. */
export function RpChatSettingsPage() {
  const { id } = useParams<{ id: string }>();
  const chatId = Number(id);
  const navigate = useTransitionNavigate();
  const { showToast } = useToast();
  const { chat, loading: chatLoading, setChat } = useChat(chatId);
  const { settings, loading: settingsLoading, update } = useChatSettings(chatId);
  const { stats, loading: statsLoading, clearing, clearVariants } = useChatStats(chatId);
  const [deleting, setDeleting] = useState(false);

  const handleUpdate = async (patch: Partial<ChatSettings>) => {
    if (!(await update(patch))) showToast({ type: "error", message: "Не удалось сохранить настройку" });
  };

  // returnTo — чтобы «Назад» Telegram с экрана персонажа/персоны/пресета вернула сюда (BackButtonBridge).
  const openLink = (target: ChatLinkTarget) =>
    navigate(linkPath(target), { state: { returnTo: chatSettingsPath(chatId) } });

  const handleClearVariants = async () => {
    const ok = await confirmAction("Очистить все сохранённые варианты реплик? Их можно будет сгенерировать заново.", {
      title: "Очистка вариантов",
      confirmText: "Очистить",
    });
    if (!ok) return;
    if (!(await clearVariants())) showToast({ type: "error", message: "Не удалось очистить варианты" });
  };

  const handleDelete = async () => {
    const ok = await confirmAction("Удалить чат? Все сообщения будут потеряны.", {
      title: "Удаление чата",
      confirmText: "Удалить",
    });
    if (!ok) return;
    setDeleting(true);
    try {
      await deleteChat(chatId);
      navigate(ROUTES.chats);
    } catch (err) {
      console.error("Failed to delete chat", err);
      showToast({ type: "error", message: "Не удалось удалить чат" });
      setDeleting(false);
    }
  };

  // Один лоадер на весь экран: три запроса идут параллельно и приходят почти вместе.
  const loading = chatLoading || settingsLoading || statsLoading;

  return (
    <AppPage title="Настройки чата" loading={loading}>
      {!chat ? (
        <EmptyState icon={MessagesSquare} title="Чат не найден" description="Возможно, он был удалён." />
      ) : (
        <>
          <ChatTitleCard
            chatId={chatId}
            title={chat.title}
            characterName={chat.character.name}
            onSaved={(title) => setChat((prev) => (prev ? { ...prev, title } : prev))}
          />
          <ChatLinksCard chat={chat} onOpen={openLink} />
          <ChatTranslateCard settings={settings} onUpdate={handleUpdate} />
          <ChatStatsCard stats={stats} clearing={clearing} onClearVariants={handleClearVariants} />
          <DeleteButton onClick={handleDelete} disabled={deleting}>
            Удалить чат
          </DeleteButton>
        </>
      )}
    </AppPage>
  );
}
