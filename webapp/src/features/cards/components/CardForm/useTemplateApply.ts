import { useState } from "react";
import { confirmAction } from "../../../../shared/telegram/confirm";
import { applyCardTemplate, templateConfirmMessage } from "../../lib/applyCardTemplate";
import type { CardCategory } from "../../types/card";
import type { CardTemplateInput } from "../../types/cardTemplate";

/** Что шаблон меняет в форме карточки. */
export interface TemplatePatch {
  systemPrompt: string;
  categories: CardCategory[];
  useWebSearch: boolean;
  useAskUser: boolean;
  askUserFirst: boolean;
}

interface UseTemplateApplyArgs {
  /** С чего стартует поле: новая карточка — со «Стандартного», открытая — без выбора. */
  initialId: number | null;
  categories: CardCategory[];
  onApply: (patch: TemplatePatch) => void;
}

/**
 * Применение шаблона к форме карточки. Если в карточке уже есть сгенерированный текст, сперва
 * подтверждение со списком полей, чей текст сохранится или пропадёт. Изменение — только в форме:
 * на сервер уходит с «Сохранить», до этого можно передумать.
 */
export function useTemplateApply({ initialId, categories, onApply }: UseTemplateApplyArgs) {
  const [appliedId, setAppliedId] = useState<number | null>(initialId);

  const pick = async (id: number, template: CardTemplateInput) => {
    const plan = applyCardTemplate(categories, template.fields, () => `custom-${crypto.randomUUID()}`);
    const hasText = categories.some((c) => c.content.trim() !== "");
    if (hasText) {
      const confirmed = await confirmAction(templateConfirmMessage(plan), {
        title: `Сменить шаблон на «${template.name}»?`,
        confirmText: "Заменить",
      });
      if (!confirmed) return;
    }
    onApply({
      systemPrompt: template.systemPrompt,
      categories: plan.categories,
      useWebSearch: template.useWebSearch,
      useAskUser: template.useAskUser,
      askUserFirst: template.askUserFirst,
    });
    setAppliedId(id);
  };

  return { appliedId, pick };
}
