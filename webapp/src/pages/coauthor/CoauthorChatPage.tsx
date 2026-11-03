import { Loader } from "@mantine/core";
import { Feather } from "lucide-react";
import { useParams } from "react-router-dom";
import { coauthorSettingsPath } from "../../app/routes";
import { useTransitionNavigate } from "../../app/useTransitionNavigate";
import { CoauthorWorkspace, useCoauthorChat } from "../../features/coauthor";
import { EmptyState } from "../../shared/components/EmptyState";
import { FullHeightPage } from "../../shared/components/FullHeightPage";
import styles from "./CoauthorChatPage.module.css";

/** Экран чата соавтора. */
export function CoauthorChatPage() {
  const { id } = useParams<{ id: string }>();
  const chatId = Number(id);
  const navigate = useTransitionNavigate();
  const { chat, setChat, loading, error } = useCoauthorChat(chatId);

  return (
    <FullHeightPage title={chat?.name ?? "Соавтор"} phase={loading ? "loading" : "ready"}>
      {chat ? (
        <CoauthorWorkspace chat={chat} setChat={setChat} onSettings={() => navigate(coauthorSettingsPath(chatId))} />
      ) : (
        <div className={styles.center}>
          {loading ? (
            <Loader />
          ) : (
            <EmptyState
              icon={Feather}
              title={error ? "Не удалось открыть чат" : "Чат не найден"}
              description="Проверьте соединение или вернитесь к списку."
            />
          )}
        </div>
      )}
    </FullHeightPage>
  );
}
