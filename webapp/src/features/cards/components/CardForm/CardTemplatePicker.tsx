import { Settings2 } from "lucide-react";
import { PickerField } from "../../../../shared/components/PickerField";
import { pluralRu } from "../../../../shared/text/pluralRu";
import { useCardTemplates } from "../../hooks/useCardTemplates";
import { STANDARD_CARD_TEMPLATE, type CardTemplateInput } from "../../types/cardTemplate";

/** id встроенного «Стандартного» в пикере: id из БД начинаются с 1 (identity), 0 не пересечётся. */
export const STANDARD_TEMPLATE_ID = 0;

/** Подпись варианта: число полей и включённые инструменты — то, что шаблон принесёт в карточку. */
function templateSummary(t: CardTemplateInput): string {
  const tools = [t.useWebSearch && "веб-поиск", t.useAskUser && "вопросы"].filter(Boolean);
  const fields = `${t.fields.length} ${pluralRu(t.fields.length, ["поле", "поля", "полей"])}`;
  return [fields, ...tools].join(" · ");
}

interface CardTemplatePickerProps {
  /** Последний применённый в этой сессии формы шаблон; null — карточка открыта, шаблон не выбирали. */
  value: number | null;
  onPick: (id: number, template: CardTemplateInput) => void;
  /** Уйти к списку шаблонов — навигация на совести страницы. */
  onManage?: () => void;
}

/**
 * Поле «Шаблон карточки»: «Стандартный» и шаблоны пользователя. Выбор не привязывает карточку к
 * шаблону — он копирует в неё системный промпт, поля и инструменты (см. useTemplateApply).
 */
export function CardTemplatePicker({ value, onPick, onManage }: CardTemplatePickerProps) {
  const { items, loading } = useCardTemplates();
  const all = [{ id: STANDARD_TEMPLATE_ID, template: STANDARD_CARD_TEMPLATE }, ...items.map((t) => ({ id: t.id, template: t }))];

  return (
    <PickerField
      label="Шаблон карточки"
      description="Копирует системный промпт, поля и инструменты — дальше их можно править здесь же"
      placeholder="Выберите шаблон"
      options={all.map(({ id, template }) => ({ id, title: template.name, description: templateSummary(template) }))}
      value={value}
      loading={loading}
      emptyText="Шаблонов нет"
      footerAction={onManage && { label: "Управлять шаблонами", icon: <Settings2 size={18} />, onClick: onManage }}
      onChange={(id) => {
        const picked = all.find((o) => o.id === id);
        if (picked) onPick(id, picked.template);
      }}
    />
  );
}
