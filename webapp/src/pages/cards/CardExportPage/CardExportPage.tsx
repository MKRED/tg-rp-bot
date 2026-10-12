import { Button } from "@mantine/core";
import { Sparkles } from "lucide-react";
import { useParams } from "react-router-dom";
import { ROUTES } from "../../../app/routes";
import { useTransitionNavigate } from "../../../app/useTransitionNavigate";
import { useCard } from "../../../features/cards";
import { AppPage } from "../../../shared/components/AppPage";
import { EmptyState } from "../../../shared/components/EmptyState";
import { CardExportForm } from "./CardExportForm";

/**
 * Экран выгрузки карточки (/cards/:id/export): превращает готовую карточку в персонажа и/или
 * персону — новую запись или обновление промпта существующей. Открывается только с сохранённой
 * карточки (кнопка «Выгрузить» в форме выключена, пока карточка не сохранена и не дописана).
 */
export function CardExportPage() {
  const navigate = useTransitionNavigate();
  const params = useParams();
  const id = params.id ? Number(params.id) : undefined;
  const { card, loading, error } = useCard(id);

  if (error || (!loading && !card)) {
    return (
      <AppPage centered>
        <EmptyState
          icon={Sparkles}
          title="Карточка не найдена"
          description="Возможно, её удалили."
          action={
            <Button variant="default" onClick={() => navigate(ROUTES.cards)}>
              К списку карточек
            </Button>
          }
        />
      </AppPage>
    );
  }

  return (
    <AppPage title="Выгрузка" description={card?.name} loading={loading}>
      {card && <CardExportForm card={card} />}
    </AppPage>
  );
}
