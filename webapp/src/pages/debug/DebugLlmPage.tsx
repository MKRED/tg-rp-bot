import { DebugLlmView } from "../../features/debug";
import { AppPage } from "../../shared/components/AppPage";

/** Экран отладки: RAW-запросы к LLM и управление перехватом. */
export function DebugLlmPage() {
  return (
    <AppPage title="Запросы к ИИ" description="Последние RAW-запросы и перехват">
      <DebugLlmView />
    </AppPage>
  );
}
