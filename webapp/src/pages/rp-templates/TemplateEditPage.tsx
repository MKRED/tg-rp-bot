import { Button } from "@mantine/core";
import { FileText } from "lucide-react";
import { useState } from "react";
import { useParams } from "react-router-dom";
import { ROUTES } from "../../app/routes";
import { useTransitionNavigate } from "../../app/useTransitionNavigate";
import {
  TemplateForm,
  createRpTemplate,
  removeRpTemplate,
  updateRpTemplate,
  useRpTemplate,
  type RpTemplateInput,
} from "../../features/rp-templates";
import { ApiError } from "../../shared/api/client";
import { AppPage } from "../../shared/components/AppPage";
import { EmptyState } from "../../shared/components/EmptyState";
import { confirmAction, showAlert } from "../../shared/telegram/confirm";
import { useToast } from "../../shared/toast";

/** Экран создания/редактирования RP-шаблона. Сохранение возвращает к списку. */
export function TemplateEditPage() {
  const navigate = useTransitionNavigate();
  const params = useParams();
  const { showToast } = useToast();
  const id = params.id ? Number(params.id) : undefined;

  const { template, loading, error } = useRpTemplate(id);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = (input: RpTemplateInput) => {
    setSubmitting(true);
    const op = id === undefined ? createRpTemplate(input) : updateRpTemplate(id, input);
    op.then(() => navigate(ROUTES.rpTemplates)).catch(() => {
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
    removeRpTemplate(id)
      .then(() => navigate(ROUTES.rpTemplates))
      .catch(async (err) => {
        setSubmitting(false);
        // 409 — FK нарушение: шаблон выбран в чате, сервер блокирует удаление.
        if (err instanceof ApiError && err.status === 409) {
          await showAlert("Шаблон используется в чате. Сначала удалите чат.", "Нельзя удалить");
        } else {
          showToast({ type: "error", message: "Не удалось удалить шаблон" });
        }
      });
  };

  if (error || (!loading && id !== undefined && !template)) {
    return (
      <AppPage centered>
        <EmptyState
          icon={FileText}
          title="Шаблон не найден"
          description="Возможно, его удалили."
          action={
            <Button variant="default" onClick={() => navigate(ROUTES.rpTemplates)}>
              К списку шаблонов
            </Button>
          }
        />
      </AppPage>
    );
  }

  return (
    <AppPage title={id === undefined ? "Новый RP-шаблон" : "RP-шаблон"} loading={loading}>
      <TemplateForm
        initial={template}
        submitting={submitting}
        onSubmit={handleSubmit}
        onDelete={id === undefined ? undefined : handleDelete}
      />
    </AppPage>
  );
}
