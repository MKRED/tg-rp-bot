import { List, Spinner } from "@telegram-apps/telegram-ui";
import { useState } from "react";
import { useParams } from "react-router-dom";
import { ROUTES } from "../../app/routes";
import { useTransitionNavigate } from "../../app/useTransitionNavigate";
import { PageTransition } from "../../shared/components/PageTransition";
import {
  TemplateForm,
  createRpTemplate,
  removeRpTemplate,
  updateRpTemplate,
  useRpTemplate,
  type RpTemplateInput,
} from "../../features/rp-templates";
import { confirmAction, showAlert } from "../../shared/telegram/confirm";
import { ApiError } from "../../shared/api/client";
import "./rp-templates.css";

/** Экран создания/редактирования RP-шаблона. */
export function TemplateEditPage() {
  const navigate = useTransitionNavigate();
  const params = useParams();
  const id = params.id ? Number(params.id) : undefined;

  const { template, loading, error } = useRpTemplate(id);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = (input: RpTemplateInput) => {
    setSubmitting(true);
    const op = id === undefined ? createRpTemplate(input) : updateRpTemplate(id, input);
    op.then(() => navigate(ROUTES.rpTemplates)).catch(() => setSubmitting(false));
  };

  const handleDelete = async () => {
    if (id === undefined) return;
    const confirmed = await confirmAction("Удалить шаблон? Это действие необратимо.", {
      title: "Удаление шаблона",
    });
    if (!confirmed) return;
    setSubmitting(true);
    removeRpTemplate(id)
      .then(() => navigate(ROUTES.rpTemplates))
      .catch(async (err) => {
        setSubmitting(false);
        // 409 — FK нарушение: шаблон выбран в чате, сервер блокирует удаление.
        if (err instanceof ApiError && err.status === 409) {
          await showAlert("Шаблон используется в чате. Сначала удалите чат.", "Нельзя удалить");
        }
      });
  };

  if (loading) {
    return (
      <PageTransition>
        <div className="rpt-page__fullcenter">
          <Spinner size="m" />
        </div>
      </PageTransition>
    );
  }
  if (error || (id !== undefined && !template)) {
    return (
      <PageTransition>
        <div className="rpt-page__fullcenter">Шаблон не найден</div>
      </PageTransition>
    );
  }

  return (
    <PageTransition>
      <div className="rpt-page">
        <List>
          <TemplateForm
            initial={template}
            submitting={submitting}
            onSubmit={handleSubmit}
            onDelete={id === undefined ? undefined : handleDelete}
          />
        </List>
      </div>
    </PageTransition>
  );
}
