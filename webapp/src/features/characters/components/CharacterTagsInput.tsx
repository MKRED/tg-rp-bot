import { Group, TagsInput, Text } from "@mantine/core";
import { useMemo } from "react";
import { useTagOptions } from "../hooks/useTagOptions";

interface CharacterTagsInputProps {
  tags: string[];
  onChange: (tags: string[]) => void;
}

/**
 * Теги персонажа: чипы + подсказки из уже использованных тегов (со счётчиком персонажей) + новый тег
 * по Enter. Уже выбранные теги Mantine сам убирает из подсказок.
 */
export function CharacterTagsInput({ tags, onChange }: CharacterTagsInputProps) {
  const options = useTagOptions();
  const countByTag = useMemo(() => new Map(options.map((o) => [o.value, o.count])), [options]);
  const data = useMemo(() => options.map((o) => o.value), [options]);

  return (
    <TagsInput
      label="Теги"
      description="Выберите из подсказок или введите новый и нажмите Enter"
      data={data}
      value={tags}
      onChange={onChange}
      clearable
      renderOption={({ option }) => (
        <Group justify="space-between" wrap="nowrap" flex={1}>
          <span>{option.value}</span>
          <Text size="xs" c="dimmed">
            {countByTag.get(option.value)}
          </Text>
        </Group>
      )}
    />
  );
}
