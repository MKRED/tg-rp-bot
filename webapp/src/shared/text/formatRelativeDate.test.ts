import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { formatRelativeDate } from "./formatRelativeDate";

describe("formatRelativeDate", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // Локальное время (без "Z"): formatRelativeDate сравнивает календарный день
    // в локальной таймзоне, поэтому и "сейчас", и вход теста задаём в локальном
    // времени — иначе тест ломается на машинах восточнее UTC (напр. Asia/Vladivostok,
    // UTC+10), где UTC-дата "сегодня" уже наступила по местному времени следующего дня.
    vi.setSystemTime(new Date(2026, 6, 23, 15, 0, 0));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("сегодняшняя дата → время", () => {
    expect(formatRelativeDate("2026-07-23T09:30:00")).toMatch(/^\d{2}:\d{2}$/);
  });

  it("прошедшая дата → день и месяц", () => {
    expect(formatRelativeDate("2026-07-20T09:30:00")).not.toMatch(/^\d{2}:\d{2}$/);
  });
});
