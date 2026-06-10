import { Spinner } from "@telegram-apps/telegram-ui";
import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ROUTES } from "../../app/routes";
import { PresetForm } from "../../features/generation-presets/PresetForm";
import {
  createPreset,
  removePreset,
  updatePreset,
} from "../../features/generation-presets/presets-api";
import { usePreset } from "../../features/generation-presets/usePreset";
import type { PresetInput } from "../../features/generation-presets/types";
import { confirmAction } from "../../shared/telegram/confirm";
import "./presets.css";

/**
 * Экран создания/редактирования пресета. Цель маршрутов /presets/new и /presets/:id:
 * при наличии id грузим пресет, иначе пустая форма. Нативная «Назад» (BackButtonBridge)
 * возвращает к списку. Preset включает все поля PresetInput, поэтому передаётся в форму напрямую.
 */
export function PresetEditPage() {
  const navigate = useNavigate();
  const params = useParams();
  const id = params.id ? Number(params.id) : undefined;

  const { preset, loading, error } = usePreset(id);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = (input: PresetInput) => {
    setSubmitting(true);
    const op = id === undefined ? createPreset(input) : updatePreset(id, input);
    op.then(() => navigate(ROUTES.presets)).catch(() => setSubmitting(false));
  };

  const handleDelete = async () => {
    if (id === undefined) return;
    // Подтверждение перед необратимым удалением — нативный попап Telegram (см. confirmAction).
    const confirmed = await confirmAction("Удалить пресет? Это действие необратимо.");
    if (!confirmed) return;
    setSubmitting(true);
    removePreset(id)
      .then(() => navigate(ROUTES.presets))
      .catch(() => setSubmitting(false));
  };

  if (loading) {
    return (
      <div className="presets-page__fullcenter">
        <Spinner size="m" />
      </div>
    );
  }

  if (error || (id !== undefined && !preset)) {
    return <div className="presets-page__fullcenter">Пресет не найден</div>;
  }

  return (
    <div className="presets-page">
      <PresetForm
        initial={preset}
        submitting={submitting}
        onSubmit={handleSubmit}
        onDelete={id === undefined ? undefined : handleDelete}
      />
    </div>
  );
}
