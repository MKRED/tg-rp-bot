import { Button, Cell, Input, Section, Spinner } from "@telegram-apps/telegram-ui";
import { Check, Trash2 } from "lucide-react";
import { confirmAction } from "../../../shared/telegram/confirm";
import type { useTavilySettings } from "../hooks/useTavilySettings";
import { formatUsageDescription, formatUsageSubtitle } from "../lib/formatUsage";
import "./TavilySettingsSection.css";

type TavilySettingsSectionProps = Omit<ReturnType<typeof useTavilySettings>, "loading">;

/**
 * Секция настроек «Веб-поиск (Tavily)»: персональный ключ (BYOK). Кнопка в after поля ввода —
 * условная, как в LlmSettingsSection: пока поле не пустое, она проверяет введённый ключ и сразу
 * сохраняет его (verifyAndSave); когда поле пустое, а ключ уже сохранён — превращается в удаление
 * ключа. У Tavily нет отдельной сущности «модель», поэтому (в отличие от LLM-секции) здесь нет
 * анимированного раскрытия/пикера — квота показывается сразу под полем, пока ключ сохранён.
 *
 * Состояние (useTavilySettings) поднято в SettingsPage — по тому же паттерну, что и useLlmSettings.
 */
export function TavilySettingsSection({
  status,
  keyInput,
  setKeyInput,
  verifying,
  verifyAndSave,
  saving,
  usage,
  usageLoading,
  clearKey,
}: TavilySettingsSectionProps) {
  const hasInput = keyInput.trim().length > 0;
  const keyAction: "save" | "delete" | "none" = hasInput ? "save" : status.hasKey ? "delete" : "none";

  const handleDeleteKey = async () => {
    const confirmed = await confirmAction("Удалить ключ Tavily? Веб-поиск перестанет работать.", {
      title: "Удалить ключ?",
    });
    if (confirmed) void clearKey();
  };

  return (
    <Section className="section-blend-inputs" header="Веб-поиск (Tavily)">
      <div className="tavily-settings">
        <Cell
          subtitle={status.hasKey ? `Ключ сохранён, оканчивается на …${status.last4}` : "Ключ не задан"}
        >
          Ключ API
        </Cell>
        <Input
          type="password"
          placeholder={status.hasKey ? "Введите новый, чтобы заменить" : "tvly-…"}
          value={keyInput}
          onChange={(e) => setKeyInput(e.target.value)}
          autoComplete="off"
          after={
            keyAction === "none" ? null : (
              <Button
                size="s"
                mode={keyAction === "delete" ? "outline" : "bezeled"}
                className={
                  keyAction === "delete"
                    ? "tavily-settings__key-action delete-button"
                    : "tavily-settings__key-action"
                }
                disabled={verifying || saving}
                onClick={() => {
                  if (keyAction === "save") void verifyAndSave();
                  else void handleDeleteKey();
                }}
                aria-label={keyAction === "delete" ? "Удалить ключ" : "Сохранить ключ"}
              >
                {verifying || saving ? (
                  <Spinner size="s" />
                ) : keyAction === "delete" ? (
                  <Trash2 size={14} />
                ) : (
                  <Check size={14} />
                )}
              </Button>
            )
          }
        />

        {status.hasKey && (
          <Cell
            subtitle={formatUsageSubtitle(usage, usageLoading)}
            description={formatUsageDescription(usage)}
          >
            Квота Tavily
          </Cell>
        )}
      </div>
    </Section>
  );
}
