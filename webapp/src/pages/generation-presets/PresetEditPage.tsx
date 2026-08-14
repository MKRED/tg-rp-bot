import { Spinner, Text } from "@telegram-apps/telegram-ui";
import { useState } from "react";
import { useLocation, useParams } from "react-router-dom";
import { ROUTES } from "../../app/routes";
import { useTransitionNavigate } from "../../app/useTransitionNavigate";
import { PageTransition } from "../../shared/components/PageTransition";
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
import "./presets.css";

/**
 * Экран создания/редактирования пресета. Цель маршрутов /presets/new и /presets/:id:
 * при наличии id грузим пресет, иначе пустая форма. Нативная «Назад» (BackButtonBridge)
 * возвращает к списку. Preset включает все поля PresetInput, поэтому передаётся в форму напрямую.
 */
export function PresetEditPage() {
  const navigate = useTransitionNavigate();
  const params = useParams();
  const location = useLocation();
  const id = params.id ? Number(params.id) : undefined;
  const returnTo = (location.state as { returnTo?: string } | null)?.returnTo;

  const { preset, loading, error } = usePreset(id);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = (input: PresetInput) => {
    setSubmitting(true);
    const op = id === undefined ? createPreset(input) : updatePreset(id, input);
    op.then(() => navigate(returnTo ?? ROUTES.presets)).catch(() => setSubmitting(false));
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
        if (err instanceof ApiError && err.status === 409) {
          await showAlert("Пресет используется в чате или истории. Сначала удалите их.", "Нельзя удалить");
        }
      });
  };

  if (loading) {
    return (
      <PageTransition>
        <div className="presets-page__fullcenter">
          <Spinner size="m" />
        </div>
      </PageTransition>
    );
  }

  if (error || (id !== undefined && !preset)) {
    return (
      <PageTransition>
        <Text Component="div" className="presets-page__fullcenter">Пресет не найден</Text>
      </PageTransition>
    );
  }

  return (
    <PageTransition>
      <div className="presets-page">
        <PresetForm
          initial={preset}
          submitting={submitting}
          onSubmit={handleSubmit}
          onDelete={id === undefined ? undefined : handleDelete}
        />
      </div>
    </PageTransition>
  );
}
