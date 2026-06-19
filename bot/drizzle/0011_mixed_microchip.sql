ALTER TABLE "generation_presets" ALTER COLUMN "prompt_order" SET DEFAULT '[{"id":"system","enabled":true},{"id":"characterDescription","enabled":true},{"id":"userDescription","enabled":false},{"id":"auxiliary","enabled":true},{"id":"characterScenario","enabled":false},{"id":"history","enabled":true},{"id":"postHistory","enabled":true}]'::jsonb;--> statement-breakpoint
ALTER TABLE "characters" ADD COLUMN "scenario" text DEFAULT '' NOT NULL;--> statement-breakpoint
-- Backfill: вставляем компонент characterScenario (выключен) прямо перед history в существующие
-- пресеты. Без этого их 6-элементный prompt_order не пройдёт валидацию (ждёт 7) и пункт «Сценарий»
-- не появится в редакторе. ord - 0.5 ставит элемент сразу перед history; нет history → в конец.
UPDATE "generation_presets"
SET "prompt_order" = (
  SELECT jsonb_agg(elem ORDER BY ord)
  FROM (
    SELECT elem, ord::numeric AS ord
    FROM jsonb_array_elements("prompt_order") WITH ORDINALITY AS t(elem, ord)
    UNION ALL
    SELECT '{"id":"characterScenario","enabled":false}'::jsonb,
           COALESCE(
             (SELECT ord - 0.5
              FROM jsonb_array_elements("prompt_order") WITH ORDINALITY AS t(elem, ord)
              WHERE elem->>'id' = 'history'),
             999)
  ) s
)
WHERE NOT ("prompt_order" @> '[{"id":"characterScenario"}]'::jsonb);