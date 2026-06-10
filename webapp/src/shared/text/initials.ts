/** Инициалы для заглушки аватара: 1–2 первые буквы слов имени. */
export function nameInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]!.toUpperCase())
    .join("");
}
