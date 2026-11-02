import { Badge, Text } from "@mantine/core";
import { LayoutTemplate } from "lucide-react";
import { ROUTES, cardTemplateEditPath } from "../../app/routes";
import { useTransitionNavigate } from "../../app/useTransitionNavigate";
import { MAX_CARD_TEMPLATES_PER_USER, STANDARD_CARD_TEMPLATE, useCardTemplates } from "../../features/cards";
import { ListRow } from "../../shared/components/ListCard";
import { ListPage } from "../../shared/components/ListPage";
import { formatRelativeDate } from "../../shared/text/formatRelativeDate";
import { pluralRu } from "../../shared/text/pluralRu";

const fieldsCount = (n: number) => `${n} ${pluralRu(n, ["поле", "поля", "полей"])}`;

/**
 * Хаб «Шаблоны карточек»: пользовательские шаблоны и создание нового. Встроенный «Стандартный»
 * не редактируется — его строка открывает новый шаблон, который стартует с той же структуры. Пока
 * своих шаблонов нет, ListPage показывает заглушку с «Создать шаблон» — то же действие, строка не нужна.
 */
export function CardTemplatesListPage() {
  const navigate = useTransitionNavigate();
  const { items, loading, error } = useCardTemplates();
  const limitReached = items.length >= MAX_CARD_TEMPLATES_PER_USER;

  return (
    <ListPage
      title="Шаблоны карточек"
      description="Системный промпт, поля и инструменты для «Мастерской»"
      icon={LayoutTemplate}
      loading={loading}
      error={error}
      count={items.length}
      limit={MAX_CARD_TEMPLATES_PER_USER}
      limitText={`Достигнут лимит в ${MAX_CARD_TEMPLATES_PER_USER} шаблонов`}
      createLabel="Создать шаблон"
      emptyTitle="Пока нет своих шаблонов"
      emptyDescription="Шаблон задаёт карточке системный промпт, поля и их порядок. Сохраните структуру удачной карточки — и начинайте следующие с неё."
      onCreate={() => navigate(ROUTES.cardTemplateNew)}
    >
      <ListRow
        index={0}
        title={STANDARD_CARD_TEMPLATE.name}
        description={`${fieldsCount(STANDARD_CARD_TEMPLATE.fields.length)} · нажмите, чтобы сделать свой на его основе`}
        // Бейдж — в meta, а не в title: title рендерится внутри <p>, а Badge — это <div>.
        meta={
          <Badge size="sm" variant="light" color="gray">
            встроенный
          </Badge>
        }
        onClick={limitReached ? undefined : () => navigate(ROUTES.cardTemplateNew)}
      />
      {items.map((t, i) => (
        <ListRow
          key={t.id}
          index={i + 1}
          title={t.name}
          description={fieldsCount(t.fields.length)}
          meta={
            <Text size="xs" c="dimmed">
              {formatRelativeDate(t.updatedAt)}
            </Text>
          }
          onClick={() => navigate(cardTemplateEditPath(t.id))}
        />
      ))}
    </ListPage>
  );
}
