import { Spinner } from "@telegram-apps/telegram-ui";
import { useState } from "react";
import { useLocation, useParams } from "react-router-dom";
import { ROUTES } from "../../app/routes";
import { useTransitionNavigate } from "../../app/useTransitionNavigate";
import { PageTransition } from "../../shared/components/PageTransition";
import {
  PersonaForm,
  createPersona,
  removePersona,
  updatePersona,
  usePersona,
  type Persona,
  type PersonaInput,
} from "../../features/personas";
import { ApiError } from "../../shared/api/client";
import { confirmAction, showAlert } from "../../shared/telegram/confirm";
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
  const navigate = useTransitionNavigate();
  const params = useParams();
  const location = useLocation();
  const id = params.id ? Number(params.id) : undefined;
  const returnTo = (location.state as { returnTo?: string } | null)?.returnTo;

  const { persona, loading, error } = usePersona(id);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = (input: PersonaInput) => {
    setSubmitting(true);
    const op = id === undefined ? createPersona(input) : updatePersona(id, input);
    op.then(() => navigate(returnTo ?? ROUTES.personas))
      .catch(() => setSubmitting(false));
  };

  const handleDelete = async () => {
    if (id === undefined) return;
    const confirmed = await confirmAction("Удалить персону? Это действие необратимо.");
    if (!confirmed) return;
    setSubmitting(true);
    removePersona(id)
      .then(() => navigate(ROUTES.personas))
      .catch(async (err) => {
        setSubmitting(false);
        if (err instanceof ApiError && err.status === 409) {
          await showAlert("Персона используется в чате. Сначала удалите чат.", "Нельзя удалить");
        }
      });
  };

  if (loading) {
    return (
      <PageTransition>
        <div className="personas-page__fullcenter">
          <Spinner size="m" />
        </div>
      </PageTransition>
    );
  }

  if (error || (id !== undefined && !persona)) {
    return (
      <PageTransition>
        <div className="personas-page__fullcenter">Персона не найдена</div>
      </PageTransition>
    );
  }

  return (
    <PageTransition>
      <div className="personas-page">
        <PersonaForm
          initial={persona ? toInput(persona) : undefined}
          submitting={submitting}
          onSubmit={handleSubmit}
          onDelete={id === undefined ? undefined : handleDelete}
        />
      </div>
    </PageTransition>
  );
}
