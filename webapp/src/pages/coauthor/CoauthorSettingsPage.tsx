import { Button, Paper, Stack, Text } from "@mantine/core";
import { Feather } from "lucide-react";
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { ROUTES, coauthorViewPath } from "../../app/routes";
import { useTransitionNavigate } from "../../app/useTransitionNavigate";
import {
  CoauthorChatForm,
  clearCoauthorChat,
  coauthorErrorMessage,
  removeCoauthorChat,
  updateCoauthorChat,
  useCoauthorChat,
  type CoauthorChatInput,
} from "../../features/coauthor";
import { AppPage } from "../../shared/components/AppPage";
import { DeleteButton } from "../../shared/components/DeleteButton";
import { EmptyState } from "../../shared/components/EmptyState";
import { confirmAction } from "../../shared/telegram/confirm";
import { useToast } from "../../shared/toast";
import { useCoauthorFormOptions } from "./useCoauthorFormOptions";

/** Настройки чата соавтора: состав карточек, пресет, свой промпт, очистка и удаление. */
export function CoauthorSettingsPage() {
  const { id } = useParams<{ id: string }>();
  const chatId = Number(id);
  const navigate = useTransitionNavigate();
  const { showToast } = useToast();
  // Опрос хода здесь не нужен: экран настроек не показывает ленту.
  const { chat, loading } = useCoauthorChat(chatId, false);
  const options = useCoauthorFormOptions();
  const [value, setValue] = useState<CoauthorChatInput>();
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!chat) return;
    setValue({
      name: chat.name,
      // Не chat.cardIds: там остаются id удалённых карточек — их не снять галочкой, а сервер отклонил бы сохранение.
      cardIds: chat.cards.map((c) => c.id),
      presetId: chat.presetId,
      systemPrompt: chat.systemPrompt,
      useAskUser: chat.useAskUser,
      useWebSearch: chat.useWebSearch,
    });
  }, [chat]);

  const save = async () => {
    if (!value) return;
    setSaving(true);
    try {
      await updateCoauthorChat(chatId, { ...value, name: value.name.trim() || (chat?.name ?? "Чат") });
      showToast({ type: "success", message: "Настройки сохранены" });
      navigate(coauthorViewPath(chatId));
    } catch (err) {
      console.error("Failed to save coauthor chat", err);
      showToast({ type: "error", message: coauthorErrorMessage(err, "Не удалось сохранить настройки") });
      setSaving(false);
    }
  };

  const clear = async () => {
    const ok = await confirmAction("Очистить переписку? Непринятые правки тоже пропадут, карточки останутся как есть.", {
      title: "Очистка переписки",
      confirmText: "Очистить",
    });
    if (!ok) return;
    try {
      await clearCoauthorChat(chatId);
      navigate(coauthorViewPath(chatId));
    } catch (err) {
      console.error("Failed to clear coauthor chat", err);
      showToast({ type: "error", message: coauthorErrorMessage(err, "Не удалось очистить переписку") });
    }
  };

  const remove = async () => {
    const ok = await confirmAction("Удалить чат? Карточки останутся как есть — пропадут только переписка и непринятые правки.", {
      title: "Удаление чата",
      confirmText: "Удалить",
    });
    if (!ok) return;
    try {
      await removeCoauthorChat(chatId);
      navigate(ROUTES.coauthor);
    } catch (err) {
      console.error("Failed to delete coauthor chat", err);
      showToast({ type: "error", message: coauthorErrorMessage(err, "Не удалось удалить чат") });
    }
  };

  return (
    <AppPage title="Настройки чата" tabTitle={chat && `${chat.name} — настройки`} loading={loading || (chat && !value)}>
      {!chat || !value ? (
        <EmptyState icon={Feather} title="Чат не найден" description="Возможно, он был удалён." />
      ) : (
        <>
          <CoauthorChatForm value={value} onChange={(patch) => setValue((prev) => prev && { ...prev, ...patch })} {...options} />
          <Button fullWidth size="md" loading={saving} disabled={value.cardIds.length === 0} onClick={() => void save()}>
            Сохранить
          </Button>
          <Paper p="md">
            <Stack gap="xs">
              <Button variant="default" fullWidth onClick={() => void clear()}>
                Очистить переписку
              </Button>
              <DeleteButton onClick={() => void remove()}>Удалить чат</DeleteButton>
              <Text size="xs" c="dimmed" ta="center">
                Карточки при этом не меняются — только чат и непринятые правки.
              </Text>
            </Stack>
          </Paper>
        </>
      )}
    </AppPage>
  );
}
