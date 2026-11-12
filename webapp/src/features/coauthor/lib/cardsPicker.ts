import type { CoauthorCardOption } from "../types/coauthor";

/** Карточки, подходящие под поиск (по имени, без учёта регистра); порядок списка сохраняется. */
export function filterCardOptions(options: CoauthorCardOption[], query: string): CoauthorCardOption[] {
  const q = query.trim().toLocaleLowerCase("ru");
  return q ? options.filter((o) => o.name.toLocaleLowerCase("ru").includes(q)) : options;
}

/**
 * Отметить или снять карточку. Порядок выбранных — порядок выбора: так карточки видят модель и экран
 * чата. На лимите новая карточка не добавляется (вызывающий заранее гасит такие строки).
 */
export function toggleCardId(value: number[], id: number, max: number): number[] {
  if (value.includes(id)) return value.filter((v) => v !== id);
  return value.length >= max ? value : [...value, id];
}

/** Выбранные карточки в порядке выбора; удалённых (нет среди вариантов) не показываем. */
export function selectedCardOptions(options: CoauthorCardOption[], value: number[]): CoauthorCardOption[] {
  const byId = new Map(options.map((o) => [o.id, o]));
  return value.flatMap((id) => byId.get(id) ?? []);
}
