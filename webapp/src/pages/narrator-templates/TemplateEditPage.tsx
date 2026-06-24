import { List, Spinner } from "@telegram-apps/telegram-ui";
import { useState } from "react";
import { useParams } from "react-router-dom";
import { ROUTES } from "../../app/routes";
import { useTransitionNavigate } from "../../app/useTransitionNavigate";
import { PageTransition } from "../../shared/components/PageTransition";
import {
  TemplateForm,
  createTemplate,
  removeTemplate,
  updateTemplate,
  useTemplate,
  type NarratorTemplateInput,
} from "../../features/narrator-templates";
import { confirmAction } from "../../shared/telegram/confirm";

/** Экран создания/редактирования narrator-шаблона. */
export function TemplateEditPage() {
  const navigate = useTransitionNavigate();
  const params = useParams();
  const id = params.id ? Number(params.id) : undefined;

  const { template, loading, error } = useTemplate(id);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = (input: NarratorTemplateInput) => {
    setSubmitting(true);
    const op = id === undefined ? createTemplate(input) : updateTemplate(id, input);
    op.then(() => navigate(ROUTES.narratorTemplates)).catch(() => setSubmitting(false));
  };

  const handleDelete = async () => {
    if (id === undefined) return;
    const confirmed = await confirmAction("Удалить шаблон? Истории, где он выбран, продолжат работать с дефолтом.");
    if (!confirmed) return;
    setSubmitting(true);
    removeTemplate(id)
      .then(() => navigate(ROUTES.narratorTemplates))
      .catch(() => setSubmitting(false));
  };

  if (loading) {
    return (
      <PageTransition>
        <div style={{ display: "flex", justifyContent: "center", padding: 48 }}>
          <Spinner size="m" />
        </div>
      </PageTransition>
    );
  }
  if (error || (id !== undefined && !template)) {
    return (
      <PageTransition>
        <div style={{ padding: 48, textAlign: "center" }}>Шаблон не найден</div>
      </PageTransition>
    );
  }

  return (
    <PageTransition>
      <div style={{ paddingBottom: 24 }}>
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
