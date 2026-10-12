import { Box, Checkbox, Collapse, SegmentedControl, Stack } from "@mantine/core";
import { PickerField, type PickerOption } from "../../../shared/components/PickerField";
import type { ExportTargetMode } from "./exportCard";

const MODE_OPTIONS = [
  { value: "create", label: "Новая запись" },
  { value: "update", label: "Обновить промпт" },
];

interface ExportTargetSectionProps {
  /** «Персонаж» / «Персона» — подпись чекбокса, поля выбора и заголовок шторки. */
  label: string;
  description: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  mode: ExportTargetMode;
  onModeChange: (mode: ExportTargetMode) => void;
  placeholder: string;
  emptyText: string;
  options: PickerOption[];
  loading: boolean;
  targetId: number | null;
  onTargetChange: (id: number) => void;
}

/**
 * Одна цель выгрузки (персонаж/персона): включена ли, создать новую запись или обновить промпт
 * существующей — тогда выбор записи. Раскрытие режима и выбора — плавное, без скачка высоты.
 */
export function ExportTargetSection({
  label,
  description,
  checked,
  onCheckedChange,
  mode,
  onModeChange,
  placeholder,
  emptyText,
  options,
  loading,
  targetId,
  onTargetChange,
}: ExportTargetSectionProps) {
  return (
    <div>
      <Checkbox
        size="md"
        label={label}
        description={description}
        checked={checked}
        onChange={(e) => onCheckedChange(e.currentTarget.checked)}
      />
      <Collapse expanded={checked}>
        <Stack gap={0} pt="md">
          <SegmentedControl
            fullWidth
            aria-label={`${label}: режим`}
            data={MODE_OPTIONS}
            value={mode}
            onChange={(v) => onModeChange(v as ExportTargetMode)}
          />
          <Collapse expanded={mode === "update"}>
            <Box pt="md">
              <PickerField
                label={label}
                required
                placeholder={placeholder}
                options={options}
                value={targetId}
                loading={loading}
                emptyText={emptyText}
                onChange={onTargetChange}
              />
            </Box>
          </Collapse>
        </Stack>
      </Collapse>
    </div>
  );
}
