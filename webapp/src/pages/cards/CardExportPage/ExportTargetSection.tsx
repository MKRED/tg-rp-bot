import { Cell, Checkbox } from "@telegram-apps/telegram-ui";
import type { ReactNode } from "react";
import { SegmentedToggle } from "../../../shared/components/SegmentedToggle";
import { ExportTargetPicker, type ExportTargetOption } from "./ExportTargetPicker";

export type ExportTargetMode = "create" | "update";

const TARGET_MODE_OPTIONS = [
  { value: "create", label: "Новый" },
  { value: "update", label: "Обновить" },
] as const satisfies { value: ExportTargetMode; label: string }[];

interface ExportTargetSectionProps {
  label: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  mode: ExportTargetMode;
  onModeChange: (mode: ExportTargetMode) => void;
  modeAriaLabel: string;
  modalTitle: string;
  placeholder: string;
  emptyHint: string;
  icon: ReactNode;
  options: ExportTargetOption[];
  loading: boolean;
  targetId: number | null;
  onTargetChange: (id: number) => void;
  renderAvatar: (option: ExportTargetOption) => ReactNode;
}

/**
 * Строка одной цели выгрузки (персонаж/персона) — чекбокс включения + тумблер режима
 * "Новый/Обновить" + (в режиме "Обновить") ExportTargetPicker для выбора конкретной записи.
 * Раньше это было продублировано инлайн в CardExportPage дважды почти один в один — вынесено
 * сюда, чтобы разница была видна только в пропсах (иконка/лейблы/данные), а не в разметке.
 *
 * Checkbox (tgui) рендерит <label> вокруг визуально скрытого <input>: клик по видимой иконке —
 * это клик по <label> (всплывает до Cell.onClick), а onClick/onChange Checkbox уходят именно на
 * <input> — их триггерит ОТДЕЛЬНЫЙ синтетический клик, который браузер сам форвардит с label на
 * input. Поэтому stopPropagation НЕ на самом Checkbox (это тормозит только синтетический клик,
 * а оригинальный всё равно всплывает до Cell.onClick — чекбокс переключался бы дважды подряд,
 * возвращаясь к исходному состоянию), а на обёртке ВОКРУГ Checkbox: гасит оригинальный клик ещё
 * до label, единственный переключатель остаётся — onChange. Тот же приём — на обёртке тумблера
 * режима в after, иначе клик по нему заодно переключал бы соседний чекбокс.
 */
export function ExportTargetSection({
  label,
  checked,
  onCheckedChange,
  mode,
  onModeChange,
  modeAriaLabel,
  modalTitle,
  placeholder,
  emptyHint,
  icon,
  options,
  loading,
  targetId,
  onTargetChange,
  renderAvatar,
}: ExportTargetSectionProps) {
  return (
    <>
      <Cell
        before={
          <div onClick={(e) => e.stopPropagation()}>
            <Checkbox checked={checked} onChange={(e) => onCheckedChange(e.target.checked)} />
          </div>
        }
        onClick={() => onCheckedChange(!checked)}
        after={
          checked && (
            <div onClick={(e) => e.stopPropagation()}>
              <SegmentedToggle options={TARGET_MODE_OPTIONS} value={mode} onChange={onModeChange} ariaLabel={modeAriaLabel} />
            </div>
          )
        }
      >
        {label}
      </Cell>
      {checked && mode === "update" && (
        <ExportTargetPicker
          modalTitle={modalTitle}
          placeholder={placeholder}
          emptyHint={emptyHint}
          icon={icon}
          options={options}
          loading={loading}
          targetId={targetId}
          onChange={onTargetChange}
          renderAvatar={renderAvatar}
        />
      )}
    </>
  );
}
