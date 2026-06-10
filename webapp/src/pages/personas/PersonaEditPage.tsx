import { Spinner } from "@telegram-apps/telegram-ui";
import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ROUTES } from "../../app/routes";
import {
  PersonaForm,
  createPersona,
  removePersona,
  updatePersona,
  usePersona,
  type Persona,
  type PersonaInput,
} from "../../features/personas";
import { confirmAction } from "../../shared/telegram/confirm";
import "./personas.css";

/** Маппинг полной персоны в значения формы. */
function toInput(p: Persona): PersonaInput {
  return {
    name: p.name,
    image: p.image,
    footnote: p.footnote,
    prompt: p.prompt,
  };
}

/**
 * Экран создания/редактирования персоны. Цель маршрутов /personas/new и /personas/:id:
 * при наличии id грузим персону, иначе пустая форма. Нативная «Назад» (BackButtonBridge)
 * возвращает к списку.
 */
export function PersonaEditPage() {
  const navigate = useNavigate();
  const params = useParams();
  const id = params.id ? Number(params.id) : undefined;

  const { persona, loading, error } = usePersona(id);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = (input: PersonaInput) => {
    setSubmitting(true);
    const op = id === undefined ? createPersona(input) : updatePersona(id, input);
    op.then(() => navigate(ROUTES.personas))
      .catch(() => setSubmitting(false));
  };

  const handleDelete = async () => {
    if (id === undefined) return;
    const confirmed = await confirmAction("Удалить персону? Это действие необратимо.");
    if (!confirmed) return;
    setSubmitting(true);
    removePersona(id)
      .then(() => navigate(ROUTES.personas))
      .catch(() => setSubmitting(false));
  };

  if (loading) {
    return (
      <div className="personas-page__fullcenter">
        <Spinner size="m" />
      </div>
    );
  }

  if (error || (id !== undefined && !persona)) {
    return <div className="personas-page__fullcenter">Персона не найдена</div>;
  }

  return (
    <div className="personas-page">
      <PersonaForm
        initial={persona ? toInput(persona) : undefined}
        submitting={submitting}
        onSubmit={handleSubmit}
        onDelete={id === undefined ? undefined : handleDelete}
      />
    </div>
  );
}
