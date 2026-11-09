import { Button, Stack, TextInput } from "@mantine/core";
import { useEffect, useState } from "react";
import { ResponsiveSheet } from "../../../shared/components/ResponsiveSheet";

/** Название по умолчанию — то же подставляет сервер, если имя пустое. */
export const DEFAULT_CANVAS_NAME = "Новый холст";

interface CanvasNameSheetProps {
  opened: boolean;
  title: string;
  submitLabel: string;
  initialName?: string;
  /** Пустое имя допустимо (создание: сервер назовёт «Новый холст»); при переименовании — нет. */
  allowEmpty?: boolean;
  loading?: boolean;
  onSubmit: (name: string) => void;
  onClose: () => void;
}

/** Шторка с названием холста: создание и переименование. Enter — то же, что кнопка. */
export function CanvasNameSheet({
  opened,
  title,
  submitLabel,
  initialName = "",
  allowEmpty = false,
  loading,
  onSubmit,
  onClose,
}: CanvasNameSheetProps) {
  const [name, setName] = useState(initialName);
  // Каждое открытие — с исходным названием, а не с недописанным в прошлый раз.
  useEffect(() => {
    if (opened) setName(initialName);
  }, [opened, initialName]);

  const disabled = !allowEmpty && !name.trim();

  return (
    <ResponsiveSheet opened={opened} onClose={onClose} title={title}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!disabled && !loading) onSubmit(name.trim());
        }}
      >
        <Stack gap="sm">
          <TextInput
            value={name}
            onChange={(e) => setName(e.currentTarget.value)}
            placeholder={DEFAULT_CANVAS_NAME}
            maxLength={200}
            aria-label="Название холста"
            data-autofocus
          />
          <Button type="submit" disabled={disabled} loading={loading}>
            {submitLabel}
          </Button>
        </Stack>
      </form>
    </ResponsiveSheet>
  );
}
