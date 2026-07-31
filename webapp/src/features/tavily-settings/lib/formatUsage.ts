import type { TavilyUsage } from "../types/tavilySettings";

export function formatUsageSubtitle(usage: TavilyUsage | null, loading: boolean): string {
  if (loading) return "Загрузка…";
  if (!usage) return "Не удалось загрузить";
  const count = usage.planLimit != null ? `${usage.planUsage} / ${usage.planLimit}` : `${usage.planUsage}`;
  return `${count} запросов`;
}

export function formatUsageDescription(usage: TavilyUsage | null): string | undefined {
  if (!usage) return undefined;
  return `план ${usage.plan}`;
}
