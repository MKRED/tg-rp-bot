import { Spinner } from "@telegram-apps/telegram-ui";
import { useState } from "react";
import { useParams } from "react-router-dom";
import { ROUTES } from "../../app/routes";
import { useTransitionNavigate } from "../../app/useTransitionNavigate";
import { PageTransition } from "../../shared/components/PageTransition";
import {
  CardForm,
  createCard,
  removeCard,
  updateCard,
  useCard,
  type Card,
  type CardInput,
} from "../../features/cards";
import { confirmAction } from "../../shared/telegram/confirm";
import { useToast } from "../../shared/toast";
import "./cards.css";

/** Маппинг полной карточки в значения формы. */
function toInput(c: Card): CardInput {
  return { name: c.name };
}

/**
 * Экран создания/редактирования карточки. Цель маршрутов /cards/new и /cards/:id:
 * при наличии id грузим карточку, иначе пустая форма. Нативная «Назад» (BackButtonBridge)
 * возвращает к списку.
 */
export function CardEditPage() {
  const navigate = useTransitionNavigate();
  const params = useParams();
  const { showToast } = useToast();
  // /cards/new → id отсутствует (создание); /cards/:id → строка с числом.
  const routeId = params.id ? Number(params.id) : undefined;

  const { card, loading, error } = useCard(routeId);
  const [submitting, setSubmitting] = useState(false);
  // После первого успешного сохранения новой карточки держим её id локально: «Сохранить»
  // больше не покидает экран (маршрут остаётся /cards/new), поэтому без этого повторное
  // сохранение продолжило бы создавать дубликаты вместо обновления уже созданной.
  const [createdId, setCreatedId] = useState<number>();
  const id = routeId ?? createdId;

  const handleSubmit = (input: CardInput) => {
    setSubmitting(true);
    const op = id === undefined ? createCard(input) : updateCard(id, input);
    return op
      .then(({ card: saved }) => {
        if (id === undefined) setCreatedId(saved.id);
        showToast({ type: "success", message: "Карточка сохранена" });
      })
      .catch((err) => {
        showToast({ type: "error", message: "Не удалось сохранить карточку" });
        throw err;
      })
      .finally(() => setSubmitting(false));
  };

  const handleDelete = async () => {
    if (id === undefined) return;
    const confirmed = await confirmAction("Удалить карточку? Это действие необратимо.", {
      title: "Удаление карточки",
    });
    if (!confirmed) return;
    setSubmitting(true);
    removeCard(id)
      .then(() => navigate(ROUTES.cards))
      .catch(() => setSubmitting(false));
  };

  if (loading) {
    return (
      <PageTransition>
        <div className="cards-page__fullcenter">
          <Spinner size="m" />
        </div>
      </PageTransition>
    );
  }

  if (error || (routeId !== undefined && !card)) {
    return (
      <PageTransition>
        <div className="cards-page__fullcenter">Карточка не найдена</div>
      </PageTransition>
    );
  }

  return (
    <PageTransition>
      <div className="cards-page">
        <CardForm
          initial={card ? toInput(card) : undefined}
          submitting={submitting}
          onSubmit={handleSubmit}
          onDelete={id === undefined ? undefined : handleDelete}
        />
      </div>
    </PageTransition>
  );
}
