import { Button } from "@mantine/core";
import { UserRound } from "lucide-react";
import { useState } from "react";
import { useParams } from "react-router-dom";
import { ROUTES } from "../../app/routes";
import { useTransitionNavigate } from "../../app/useTransitionNavigate";
import { AppPage } from "../../shared/components/AppPage";
import { EmptyState } from "../../shared/components/EmptyState";
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
import { useToast } from "../../shared/toast";

/** Маппинг полной персоны в значения формы. */
function toInput(p: Persona): PersonaInput {
  return {
    name: p.name,
    image: p.image,
    imageFull: p.imageFull,
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
  const { showToast } = useToast();
  // /personas/new → id отсутствует (создание); /personas/:id → строка с числом.
  const routeId = params.id ? Number(params.id) : undefined;

  const { persona, loading, error } = usePersona(routeId);
  const [submitting, setSubmitting] = useState(false);
  // После первого успешного сохранения новой персоны держим её id локально: «Сохранить»
  // больше не покидает экран (маршрут остаётся /personas/new), поэтому без этого повторное
  // сохранение продолжило бы создавать дубликаты вместо обновления уже созданной.
  const [createdId, setCreatedId] = useState<number>();
  const id = routeId ?? createdId;

  const handleSubmit = (input: PersonaInput) => {
    setSubmitting(true);
    const op = id === undefined ? createPersona(input) : updatePersona(id, input);
    return op
      .then(({ persona: saved }) => {
        if (id === undefined) setCreatedId(saved.id);
        showToast({ type: "success", message: "Персона сохранена" });
      })
      .catch((err) => {
        showToast({ type: "error", message: "Не удалось сохранить персону" });
        throw err;
      })
      .finally(() => setSubmitting(false));
  };

  const handleDelete = async () => {
    if (id === undefined) return;
    const confirmed = await confirmAction("Удалить персону? Это действие необратимо.", {
      title: "Удаление персоны",
    });
    if (!confirmed) return;
    setSubmitting(true);
    removePersona(id)
      .then(() => navigate(ROUTES.personas))
      .catch(async (err) => {
        setSubmitting(false);
        if (err instanceof ApiError && err.status === 409) {
          await showAlert("Персона используется в чате. Сначала удалите чат.", "Нельзя удалить");
        } else {
          showToast({ type: "error", message: "Не удалось удалить персону" });
        }
      });
  };

  if (error || (!loading && routeId !== undefined && !persona)) {
    return (
      <AppPage centered>
        <EmptyState
          icon={UserRound}
          title="Персона не найдена"
          description="Возможно, её удалили."
          action={<Button variant="default" onClick={() => navigate(ROUTES.personas)}>К списку персон</Button>}
        />
      </AppPage>
    );
  }

  return (
    <AppPage title={id === undefined ? "Новая персона" : "Персона"} tabTitle={persona && `${persona.name} — персона`} loading={loading}>
      <PersonaForm
        initial={persona ? toInput(persona) : undefined}
        submitting={submitting}
        onSubmit={handleSubmit}
        onDelete={id === undefined ? undefined : handleDelete}
      />
    </AppPage>
  );
}
