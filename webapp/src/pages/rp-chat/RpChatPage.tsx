import { PageTransition } from "../../shared/components/PageTransition";
import "./rp-chat.css";

/** Экран конкретного чата — временная заглушка до реализации полноценного UI. */
export function RpChatPage() {
  return (
    <PageTransition>
      <div className="rp-chat-page">
        <span>Чат в разработке</span>
      </div>
    </PageTransition>
  );
}
