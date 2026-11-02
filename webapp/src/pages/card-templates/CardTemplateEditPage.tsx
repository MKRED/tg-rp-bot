import { Button } from "@mantine/core";
import { LayoutTemplate } from "lucide-react";
import { useState } from "react";
import { useParams } from "react-router-dom";
import { ROUTES } from "../../app/routes";
import { useTransitionNavigate } from "../../app/useTransitionNavigate";
import {
  CardTemplateForm,
  createCardTemplate,
  removeCardTemplate,
  updateCardTemplate,
  useCardTemplate,
  type CardTemplateInput,
} from "../../features/cards";
import { AppPage } from "../../shared/components/AppPage";
import { EmptyState } from "../../shared/components/EmptyState";
import { confirmAction } from "../../shared/telegram/confirm";
import { useToast } from "../../shared/toast";

/** Экран создания/редактирования шаблона карточки. Сохранение возвращает к списку. */
export function CardTemplateEditPage() {
  const navigate = useTransitionNavigate();
  const params = useParams();
  const { showToast } = useToast();
  const id = params.id ? Number(params.id) : undefined;

  const { template, loading, error } = useCardTemplate(id);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = (input: CardTemplateInput) => {
    setSubmitting(true);
    const op = id === undefined ? createCardTemplate(input) : updateCardTemplate(id, input);
    op.then(() => navigate(ROUTES.cardTemplates)).catch(() => {
      setSubmitting(false);
      showToast({ type: "error", message: "Не удалось сохранить шаблон" });
    });
  };

  // Карточки шаблон не держат (при выборе он копируется), поэтому удаление ничего не ломает.
  const handleDelete = async () => {
    if (id === undefined) return;
    const confirmed = await confirmAction("Удалить шаблон? Созданные по нему карточки останутся как есть.", {
      title: "Удаление шаблона",
    });
    if (!confirmed) return;
    setSubmitting(true);
    removeCardTemplate(id)
      .then(() => navigate(ROUTES.cardTemplates))
      .catch(() => {
        setSubmitting(false);
        showToast({ type: "error", message: "Не удалось удалить шаблон" });
      });
  };

  if (error || (!loading && id !== undefined && !template)) {
    return (
      <AppPage centered>
        <EmptyState
          icon={LayoutTemplate}
          title="Шаблон не найден"
          description="Возможно, его удалили."
          action={
            <Button variant="default" onClick={() => navigate(ROUTES.cardTemplates)}>
              К списку шаблонов
            </Button>
          }
        />
      </AppPage>
    );
  }

  return (
    <AppPage
      title={id === undefined ? "Новый шаблон карточки" : "Шаблон карточки"}
      tabTitle={template && `${template.name} — шаблон карточки`}
      loading={loading}
    >
      {/* key: форма берёт начальные значения один раз — после загрузки шаблона монтируем её заново. */}
      {(id === undefined || template) && (
        <CardTemplateForm
          key={template?.id ?? "new"}
          initial={template}
          submitting={submitting}
          onSubmit={handleSubmit}
          onDelete={id === undefined ? undefined : handleDelete}
        />
      )}
    </AppPage>
  );
}
