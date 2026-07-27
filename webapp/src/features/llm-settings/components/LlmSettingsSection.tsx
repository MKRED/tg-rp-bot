import { Button, Cell, Input, Spinner } from "@telegram-apps/telegram-ui";
import { DeleteButton } from "../../../shared/components/DeleteButton";
import { SectionWithFooter } from "../../../shared/components/SectionWithFooter";
import { confirmAction } from "../../../shared/telegram/confirm";
import type { useLlmSettings } from "../hooks/useLlmSettings";
import { DeepSeekModelPicker } from "./DeepSeekModelPicker";
import "./LlmSettingsSection.css";

type LlmSettingsSectionProps = Omit<ReturnType<typeof useLlmSettings>, "loading">;

/**
 * Секция настроек «ИИ (DeepSeek)»: персональный ключ + модель (BYOK — общего ключа из env нет,
 * без ключа генерация и ИИ-перевод падают с понятной ошибкой). «Проверить ключ» одним запросом
 * и валидирует ключ, и подтягивает список моделей — выбор модели недоступен, пока список не
 * получен в этой сессии.
 *
 * Состояние (useLlmSettings) поднято в SettingsPage — загрузка статуса показывается на весь
 * экран настроек, а не спиннером внутри секции, чтобы контент не «прыгал» при смене вкладки.
 */
export function LlmSettingsSection({
  status,
  keyInput,
  setKeyInput,
  models,
  selectedModel,
  setSelectedModel,
  verifying,
  verifyError,
  verify,
  saving,
  saveError,
  save,
  clearKey,
}: LlmSettingsSectionProps) {
  const canVerify = !verifying && (keyInput.trim().length > 0 || status.hasKey);
  const canSave = !saving && (keyInput.trim().length > 0 || status.hasKey) && Boolean(selectedModel);

  const handleDeleteKey = async () => {
    const confirmed = await confirmAction("Удалить ключ DeepSeek? Генерация перестанет работать.", {
      title: "Удалить ключ?",
    });
    if (confirmed) void clearKey();
  };

  return (
    <SectionWithFooter
      header="ИИ (DeepSeek)"
      footer="Ключ хранится в зашифрованном виде на сервере бота. Без ключа генерация и ИИ-перевод недоступны."
    >
      <div className="llm-settings">
        <Cell
          subtitle={status.hasKey ? `Ключ сохранён, оканчивается на …${status.last4}` : "Ключ не задан"}
        >
          Ключ API
        </Cell>
        <div className="llm-settings__field">
          <Input
            type="password"
            placeholder={status.hasKey ? "Введите новый, чтобы заменить" : "sk-…"}
            value={keyInput}
            onChange={(e) => setKeyInput(e.target.value)}
            autoComplete="off"
          />
        </div>

        <div className="llm-settings__actions">
          <Button size="s" mode="bezeled" disabled={!canVerify} onClick={() => void verify()}>
            {verifying ? <Spinner size="s" /> : "Проверить ключ"}
          </Button>
        </div>
        {verifyError && <p className="llm-settings__error">{verifyError}</p>}

        {(models || status.model) && (
          <Cell
            subtitle={models ? "Список получен от DeepSeek" : "Проверьте ключ, чтобы сменить модель"}
            after={
              <DeepSeekModelPicker
                value={selectedModel}
                options={models ?? (status.model ? [status.model] : [])}
                onChange={setSelectedModel}
                disabled={!models}
              />
            }
          >
            Модель
          </Cell>
        )}

        <div className="llm-settings__field">
          <Button size="l" stretched disabled={!canSave} onClick={() => void save()}>
            {saving ? <Spinner size="s" /> : "Сохранить"}
          </Button>
        </div>
        {saveError && <p className="llm-settings__error">{saveError}</p>}

        {status.hasKey && (
          <div className="llm-settings__field">
            <DeleteButton disabled={saving} onClick={() => void handleDeleteKey()}>
              Удалить ключ
            </DeleteButton>
          </div>
        )}
      </div>
    </SectionWithFooter>
  );
}
