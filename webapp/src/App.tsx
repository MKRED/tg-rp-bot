import { AppRoot } from "@telegram-apps/telegram-ui";
import { RpChat } from "./features/rp-chat/RpChat";

/** Корень приложения. AppRoot из telegram-ui подставляет тему/платформу Telegram. */
export function App() {
  return (
    <AppRoot>
      <RpChat />
    </AppRoot>
  );
}
