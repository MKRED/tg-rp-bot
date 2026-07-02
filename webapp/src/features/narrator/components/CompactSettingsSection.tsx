import { Button, Cell, Section, Slider, Spinner, Switch } from "@telegram-apps/telegram-ui";
import { ChevronDown, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { FieldHint } from "../../../shared/components/FieldHint";
import { confirmAction } from "../../../shared/telegram/confirm";
import { useToast } from "../../../shared/toast";
import { useCompactions } from "../hooks/useCompactions";
import type { StorySettings, StoryStats } from "../types/story";

const FLOOR_MIN = 1000;
const FLOOR_STEP = 500;
const WORDS_MIN = 50;
const WORDS_MAX = 800;
const WORDS_STEP = 50;

/** Текст причины недоступности фичи под гейтом. */
const REASON_TEXT: Record<NonNullable<StoryStats["compactReason"]>, string> = {
  unlimited: "Недоступно при безграничном контексте",
  too_small: "Слишком маленькое контекстное окно",
  template_off: "Включите компонент «Краткое содержание» в Порядке промптов шаблона",
};

const fmt = (n: number) => n.toLocaleString("ru-RU");

interface CompactSettingsSectionProps {
  storyId: number;
  settings: StorySettings;
  updateSettings: (patch: Partial<StorySettings>) => void;
  stats: StoryStats;
  /** Перезагрузить статистику после сжатия/удаления (бюджет контекста меняется). */
  onChanged: () => void;
}

/**
 * Секция «Сжатие истории» (compact): мастер-тумблер + авто-тумблер + слайдеры (пол токенов, число
 * слов) + кнопка ручного сжатия + список пересказов с удалением. Недоступна, если у пресета нет
 * лимита / он слишком мал / выключен компонент `compact` в шаблоне — тогда контролы задизейблены.
 * Слайдеры держат локальное состояние и коммитят настройки с debounce (чтобы не слать PUT на тик).
 */
export function CompactSettingsSection({
  storyId,
  settings,
  updateSettings,
  stats,
  onChanged,
}: CompactSettingsSectionProps) {
  const { showToast } = useToast();
  const { compactions, loading, busy, compact, remove } = useCompactions(storyId);
  // Пересказы свёрнуты по умолчанию (текст длинный, не должен занимать место в настройках).
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const toggleExpanded = (id: number) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const available = stats.compactAvailable;
  const limit = stats.contextLimit ?? 0;
  const floorMax = Math.max(FLOOR_MIN, Math.round(limit * 0.9));
  const defaultFloor = Math.round(limit * 0.7);

  // Локальные значения слайдеров + debounce-коммит.
  const [floor, setFloor] = useState(defaultFloor);
  const [words, setWords] = useState(settings.compactWords);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Накапливаем патч между тиками: два слайдера делят один таймер, поэтому правки коалесим,
  // иначе коммит второго слайдера затёр бы отложенный коммит первого.
  const pending = useRef<Partial<StorySettings>>({});

  useEffect(() => {
    const stored = settings.compactFloorTokens > 0 ? settings.compactFloorTokens : defaultFloor;
    setFloor(Math.max(FLOOR_MIN, Math.min(stored, floorMax)));
  }, [settings.compactFloorTokens, floorMax, defaultFloor]);

  useEffect(() => {
    setWords(Math.max(WORDS_MIN, Math.min(settings.compactWords, WORDS_MAX)));
  }, [settings.compactWords]);

  // Чистим отложенный таймер при размонтировании — иначе коммит сработал бы после ухода со страницы.
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const commit = (patch: Partial<StorySettings>) => {
    pending.current = { ...pending.current, ...patch };
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      updateSettings(pending.current);
      pending.current = {};
    }, 400);
  };

  const handleCompact = async () => {
    try {
      const created = await compact();
      onChanged();
      showToast(
        created > 0
          ? { type: "success", message: `Создано пересказов: ${created}` }
          : { message: "Историю ещё не нужно сжимать" },
      );
    } catch (err) {
      console.error("Failed to compact story", err);
      showToast({ type: "error", message: "Не удалось сжать историю" });
    }
  };

  const handleRemove = async (id: number) => {
    const ok = await confirmAction("Удалить этот и все последующие пересказы?", {
      title: "Удаление пересказа",
      confirmText: "Удалить",
    });
    if (!ok) return;
    try {
      await remove(id);
      onChanged();
    } catch (err) {
      console.error("Failed to delete compaction", err);
      showToast({ type: "error", message: "Не удалось удалить пересказ" });
    }
  };

  return (
    <Section header="Сжатие истории">
      {/* Один top-level child (Fragment) — иначе Section считает соседние {cond && …} отдельными
          «слотами» и вставляет Divider по позиции, даже когда слот пуст (docs/telegram-ui.md, 1.4.2). */}
      <>
        <Cell
          after={
            <Switch
              checked={settings.compactEnabled}
              disabled={!available}
              onChange={(e) => updateSettings({ compactEnabled: e.target.checked })}
            />
          }
          subtitle="Сжимать старые сообщения в краткий пересказ, освобождая контекст"
        >
          Сжатие истории
        </Cell>

        {!available && stats.compactReason && (
          <p className="section-note">{REASON_TEXT[stats.compactReason]}</p>
        )}

        {available && settings.compactEnabled && (
          <>
            <Cell
              after={
                <Switch
                  checked={settings.compactAutoEnabled}
                  onChange={(e) => updateSettings({ compactAutoEnabled: e.target.checked })}
                />
              }
              subtitle="Сжимать автоматически при приближении к лимиту контекста"
            >
              Авто-сжатие
            </Cell>

            <div style={{ padding: "8px 22px 0" }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 500 }}>
                <span>Сжимать до</span>
                <span style={{ color: "var(--tg-theme-hint-color)" }}>{fmt(floor)} ток.</span>
              </div>
              <Slider
                min={FLOOR_MIN}
                max={floorMax}
                step={FLOOR_STEP}
                value={floor}
                onChange={(v) => {
                  setFloor(v);
                  commit({ compactFloorTokens: v });
                }}
              />
              <FieldHint>
                При сжатии оставляем примерно столько токенов живой истории (из {fmt(limit)} лимита).
              </FieldHint>
            </div>

            <div style={{ padding: "8px 22px 0" }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 500 }}>
                <span>Слов в пересказе</span>
                <span style={{ color: "var(--tg-theme-hint-color)" }}>~{words}</span>
              </div>
              <Slider
                min={WORDS_MIN}
                max={WORDS_MAX}
                step={WORDS_STEP}
                value={words}
                onChange={(v) => {
                  setWords(v);
                  commit({ compactWords: v });
                }}
              />
              <FieldHint>
                Рекомендованный объём каждого пересказа (плейсхолдер {"{{words}}"} в промпте сжатия).
              </FieldHint>
            </div>

            <div style={{ padding: "12px 22px 4px" }}>
              <Button size="m" stretched disabled={busy} onClick={handleCompact}>
                {busy ? "Сжимаю…" : "Сжать сейчас"}
              </Button>
            </div>

            {loading ? (
              <div style={{ display: "flex", justifyContent: "center", padding: 16 }}>
                <Spinner size="s" />
              </div>
            ) : compactions.length === 0 ? (
              <p className="section-note">Пересказов пока нет.</p>
            ) : (
              compactions.map((c, i) => {
                const isExpanded = expanded.has(c.id);
                return (
                  // Свой layout вместо Cell+after: иначе кнопка в `after` центрируется по всей высоте
                  // многострочного пересказа и забирает правую колонку у текста. Шапка (заголовок +
                  // удаление) сверху, текст пересказа — на всю ширину под ней, свёрнут по умолчанию.
                  <div key={c.id} style={{ padding: "10px 22px" }}>
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => toggleExpanded(c.id)}
                      onKeyDown={(e) => {
                        if (e.key !== "Enter" && e.key !== " ") return;
                        e.preventDefault();
                        toggleExpanded(c.id);
                      }}
                      aria-expanded={isExpanded}
                      style={{
                        display: "flex",
                        width: "100%",
                        alignItems: "center",
                        justifyContent: "space-between",
                        cursor: "pointer",
                      }}
                    >
                      <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <ChevronDown
                          size={16}
                          style={{
                            transform: isExpanded ? "rotate(0deg)" : "rotate(-90deg)",
                            transition: "transform 0.15s",
                            flexShrink: 0,
                          }}
                        />
                        <span style={{ fontWeight: 500 }}>Пересказ {i + 1}</span>
                      </span>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemove(c.id);
                        }}
                        aria-label="Удалить пересказ"
                        style={{
                          display: "flex",
                          background: "none",
                          border: "none",
                          cursor: "pointer",
                          color: "#e53935",
                          padding: 4,
                          margin: -4, // компенсируем padding, чтобы иконка вставала вровень с краем
                        }}
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                    {isExpanded && (
                      <>
                        <p
                          style={{
                            margin: "4px 0 0",
                            color: "var(--tg-theme-hint-color)",
                            fontSize: 14,
                            lineHeight: 1.4,
                            whiteSpace: "pre-wrap",
                          }}
                        >
                          {c.summary}
                        </p>
                        <p
                          style={{
                            margin: "4px 0 0",
                            color: "var(--tg-theme-text-color)",
                            fontSize: 12,
                            fontWeight: 500,
                          }}
                        >
                          Сжато сообщений: {c.coveredCount}, токенов: {fmt(c.coveredTokens)}
                        </p>
                      </>
                    )}
                  </div>
                );
              })
            )}
          </>
        )}
      </>
    </Section>
  );
}
