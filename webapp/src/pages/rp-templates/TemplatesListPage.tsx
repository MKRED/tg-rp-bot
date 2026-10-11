import { Text } from "@mantine/core";
import { FileText } from "lucide-react";
import { ROUTES, rpTemplateEditPath } from "../../app/routes";
import { useTransitionNavigate } from "../../app/useTransitionNavigate";
import { MAX_RP_TEMPLATES_PER_USER, useRpTemplates } from "../../features/rp-templates";
import { ListRow } from "../../shared/components/ListCard";
import { ListPage } from "../../shared/components/ListPage";
import { formatRelativeDate } from "../../shared/text/formatRelativeDate";

/** Хаб «RP-шаблоны»: все шаблоны пользователя и создание нового. */
export function TemplatesListPage() {
  const navigate = useTransitionNavigate();
  const { items, loading, error } = useRpTemplates();

  return (
    <ListPage
      title="RP-шаблоны"
      description="Промпты и порядок их сборки для RP-чата"
      icon={FileText}
      loading={loading}
      error={error}
      count={items.length}
      limit={MAX_RP_TEMPLATES_PER_USER}
      limitText={`Достигнут лимит в ${MAX_RP_TEMPLATES_PER_USER} шаблонов`}
      createLabel="Создать шаблон"
      emptyTitle="Пока нет шаблонов"
      emptyDescription="Шаблон задаёт системный промпт, служебные инструкции и порядок сборки запроса к нейросети."
      onCreate={() => navigate(ROUTES.rpTemplateNew)}
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
          onClick={() => navigate(rpTemplateEditPath(t.id))}
        />
      ))}
    </ListPage>
  );
}
