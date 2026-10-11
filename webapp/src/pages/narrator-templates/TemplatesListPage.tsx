import { Text } from "@mantine/core";
import { ScrollText } from "lucide-react";
import { ROUTES, narratorTemplateEditPath } from "../../app/routes";
import { useTransitionNavigate } from "../../app/useTransitionNavigate";
import { MAX_NARRATOR_TEMPLATES_PER_USER, useTemplates } from "../../features/narrator-templates";
import { ListRow } from "../../shared/components/ListCard";
import { ListPage } from "../../shared/components/ListPage";
import { formatRelativeDate } from "../../shared/text/formatRelativeDate";

/** Хаб «Narrator-шаблоны»: все narrator-шаблоны пользователя и создание нового. */
export function TemplatesListPage() {
  const navigate = useTransitionNavigate();
  const { items, loading, error } = useTemplates();

  return (
    <ListPage
      title="Narrator-шаблоны"
      description="Инструкция нарратора для режима «Режиссёр истории»"
      icon={ScrollText}
      loading={loading}
      error={error}
      count={items.length}
      limit={MAX_NARRATOR_TEMPLATES_PER_USER}
      limitText={`Достигнут лимит в ${MAX_NARRATOR_TEMPLATES_PER_USER} шаблонов`}
      createLabel="Создать шаблон"
      emptyTitle="Пока нет шаблонов"
      emptyDescription="Шаблон задаёт, как рассказчик ведёт историю: инструкцию, перевод, сжатие и порядок сборки запроса."
      onCreate={() => navigate(ROUTES.narratorTemplateNew)}
    >
      {items.map((t, i) => (
        <ListRow
          key={t.id}
          index={i}
          title={t.name}
          description={`~${t.templateTokens} токенов промпта`}
          meta={
            <Text size="xs" c="dimmed">
              {formatRelativeDate(t.updatedAt)}
            </Text>
          }
          onClick={() => navigate(narratorTemplateEditPath(t.id))}
        />
      ))}
    </ListPage>
  );
}
