import { Button } from "@mantine/core";
import { ScrollText } from "lucide-react";
import { useState } from "react";
import { useParams } from "react-router-dom";
import { ROUTES } from "../../app/routes";
import { useTransitionNavigate } from "../../app/useTransitionNavigate";
import {
  TemplateForm,
  createTemplate,
  removeTemplate,
  updateTemplate,
  useTemplate,
  type NarratorTemplateInput,
} from "../../features/narrator-templates";
import { ApiError } from "../../shared/api/client";
import { AppPage } from "../../shared/components/AppPage";
import { EmptyState } from "../../shared/components/EmptyState";
import { confirmAction, showAlert } from "../../shared/telegram/confirm";
import { useToast } from "../../shared/toast";

/** Экран создания/редактирования narrator-шаблона. Сохранение возвращает к списку. */
export function TemplateEditPage() {
  const navigate = useTransitionNavigate();
  const params = useParams();
  const { showToast } = useToast();
  const id = params.id ? Number(params.id) : undefined;

  const { template, loading, error } = useTemplate(id);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = (input: NarratorTemplateInput) => {
    setSubmitting(true);
    const op = id === undefined ? createTemplate(input) : updateTemplate(id, input);
    op.then(() => navigate(ROUTES.narratorTemplates)).catch(() => {
      setSubmitting(false);
      showToast({ type: "error", message: "Не удалось сохранить шаблон" });
    });
  };

  const handleDelete = async () => {
    if (id === undefined) return;
    const confirmed = await confirmAction("Удалить шаблон? Это действие необратимо.", {
      title: "Удаление шаблона",
    });
    if (!confirmed) return;
    setSubmitting(true);
    removeTemplate(id)
      .then(() => navigate(ROUTES.narratorTemplates))
      .catch(async (err) => {
        setSubmitting(false);
        // 409 — FK нарушение: шаблон выбран в истории, сервер блокирует удаление.
        if (err instanceof ApiError && err.status === 409) {
          await showAlert("Шаблон используется в истории. Сначала удалите историю.", "Нельзя удалить");
        } else {
          showToast({ type: "error", message: "Не удалось удалить шаблон" });
        }
      });
  };

  if (error || (!loading && id !== undefined && !template)) {
    return (
      <AppPage centered>
        <EmptyState
          icon={ScrollText}
          title="Шаблон не найден"
          description="Возможно, его удалили."
          action={
            <Button variant="default" onClick={() => navigate(ROUTES.narratorTemplates)}>
              К списку шаблонов
            </Button>
          }
        />
      </AppPage>
    );
  }

  return (
    <AppPage title={id === undefined ? "Новый narrator-шаблон" : "Narrator-шаблон"} loading={loading}>
      <TemplateForm
        initial={template}
        submitting={submitting}
        onSubmit={handleSubmit}
        onDelete={id === undefined ? undefined : handleDelete}
      />
    </AppPage>
  );
}
