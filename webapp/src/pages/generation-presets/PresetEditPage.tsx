import { Button } from "@mantine/core";
import { SlidersHorizontal } from "lucide-react";
import { useState } from "react";
import { useLocation, useParams } from "react-router-dom";
import { ROUTES } from "../../app/routes";
import { useTransitionNavigate } from "../../app/useTransitionNavigate";
import { AppPage } from "../../shared/components/AppPage";
import { EmptyState } from "../../shared/components/EmptyState";
import {
  PresetForm,
  createPreset,
  removePreset,
  updatePreset,
  usePreset,
  type PresetInput,
} from "../../features/generation-presets";
import { ApiError } from "../../shared/api/client";
import { confirmAction, showAlert } from "../../shared/telegram/confirm";
import { useToast } from "../../shared/toast";

/**
 * Экран создания/редактирования пресета. Цель маршрутов /presets/new и /presets/:id:
 * при наличии id грузим пресет, иначе пустая форма. Сохранение возвращает к списку — или туда,
 * откуда пришли (state.returnTo, напр. настройки чата). Preset включает все поля PresetInput,
 * поэтому передаётся в форму напрямую.
 */
export function PresetEditPage() {
  const navigate = useTransitionNavigate();
  const params = useParams();
  const location = useLocation();
  const { showToast } = useToast();
  const id = params.id ? Number(params.id) : undefined;
  const returnTo = (location.state as { returnTo?: string } | null)?.returnTo;

  const { preset, loading, error } = usePreset(id);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = (input: PresetInput) => {
    setSubmitting(true);
    const op = id === undefined ? createPreset(input) : updatePreset(id, input);
    op.then(() => navigate(returnTo ?? ROUTES.presets)).catch(() => {
      setSubmitting(false);
      showToast({ type: "error", message: "Не удалось сохранить пресет" });
    });
  };

  const handleDelete = async () => {
    if (id === undefined) return;
    // Подтверждение перед необратимым удалением — нативный попап Telegram (см. confirmAction).
    const confirmed = await confirmAction("Удалить пресет? Это действие необратимо.", {
      title: "Удаление пресета",
    });
    if (!confirmed) return;
    setSubmitting(true);
    removePreset(id)
      .then(() => navigate(ROUTES.presets))
      .catch(async (err) => {
        setSubmitting(false);
        // 409 — FK нарушение: пресет выбран в чате или истории.
        if (err instanceof ApiError && err.status === 409) {
          await showAlert("Пресет используется в чате или истории. Сначала удалите их.", "Нельзя удалить");
        } else {
          showToast({ type: "error", message: "Не удалось удалить пресет" });
        }
      });
  };

  if (error || (!loading && id !== undefined && !preset)) {
    return (
      <AppPage centered>
        <EmptyState
          icon={SlidersHorizontal}
          title="Пресет не найден"
          description="Возможно, его удалили."
          action={
            <Button variant="default" onClick={() => navigate(ROUTES.presets)}>
              К списку пресетов
            </Button>
          }
        />
      </AppPage>
    );
  }

  return (
    <AppPage title={id === undefined ? "Новый пресет" : "Пресет"} tabTitle={preset && `${preset.name} — пресет`} loading={loading}>
      <PresetForm
        initial={preset}
        submitting={submitting}
        onSubmit={handleSubmit}
        onDelete={id === undefined ? undefined : handleDelete}
      />
    </AppPage>
  );
}
