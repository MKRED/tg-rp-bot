import { PageTransition } from "../../shared/components/PageTransition";
import { DebugLlmView } from "../../features/debug";

/** Экран отладки: RAW-запросы к LLM и управление перехватом. */
export function DebugLlmPage() {
  return (
    <PageTransition>
      <DebugLlmView />
    </PageTransition>
  );
}
