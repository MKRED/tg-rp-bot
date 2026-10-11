import type { KeyboardEvent } from "react";
import { nextChoiceIndex } from "./choiceKeys";

/**
 * Клавиатура группы ChoiceCard по паттерну radiogroup: в Tab-порядке только выбранный вариант
 * (roving tabindex), стрелки/Home/End выбирают соседний и переводят на него фокус.
 */
export function useChoiceGroup<T extends string>(ids: readonly T[], value: T, onChange: (id: T) => void) {
  const groupProps = {
    role: "radiogroup",
    onKeyDown: (event: KeyboardEvent<HTMLElement>) => {
      const next = nextChoiceIndex(ids.indexOf(value), event.key, ids.length);
      if (next === null) return;
      event.preventDefault();
      onChange(ids[next]!);
      event.currentTarget.querySelectorAll<HTMLElement>('[role="radio"]')[next]?.focus();
    },
  } as const;

  const tabIndexOf = (id: T) => (id === value ? 0 : -1);

  return { groupProps, tabIndexOf };
}
