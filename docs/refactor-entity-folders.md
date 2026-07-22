# Рефакторинг — разнесение сущностей по подпапкам

Задача на отдельную сессию: применить правило «Папка-сущность, когда сущность обрастает файлами»
(CLAUDE.md, раздел «Структура и размер файлов — mandatory») к местам, где оно уже нарушается.
Правило появилось позже кода — эти места не баг, а технический долг, накопленный до правила.

**Когда запускать:** по прямой просьбе пользователя со ссылкой на этот файл. Дедлайна нет — чисто
чистка структуры, поведение не меняется.

## Напоминание правила

Как только у одной сущности (компонент, модуль, DAO и т.п.) появляется **≥2 файла-реализации сверх
основного** (стили `.css`, `.constants.ts`, `.types.ts`, второй `.ts` с логикой и т.д.) — сущность
переезжает в свою подпапку по имени: `EntityName/EntityName.ts(x)`, `EntityName.constants.ts`,
`EntityName.css`, … + `index.ts`-барrel, реэкспортирующий публичную поверхность. Один сопутствующий
`.test.ts` подпапку не триггерит — это норма. Правило действует по всему проекту (bot/ и webapp/).

## Найденные нарушения

### `bot/src/server/prompt/`
- `promptBuilder` — `promptBuilder.ts` + `.constants.ts` + `.types.ts` (+ `.test.ts`)
- `storyPromptBuilder` — `storyPromptBuilder.ts` + `.constants.ts` + `.types.ts` (+ `.test.ts`)
- Не трогать: `compactionPlan`, `keywordMatch` (1 файл + тест), `budget` (1 файл) — не нарушают.

### `bot/src/server/media/`
- `photoToChat` — `.ts` + `.constants.ts` + `.types.ts`
- `profilePhoto` — `.ts` + `.constants.ts` + `.types.ts`
- В папке нет `index.ts` — при разнесении завести барrel на уровне `media/`.

### `webapp/src/shared/components/`
19 из 23 компонентов имеют пару `.tsx`+`.css` вперемешку с остальными:
`AvatarPicker`, `DeleteButton`, `ExpandableTextarea`, `FieldHint`, `HintedInput`, `ImageCropEditor`,
`ImageLightbox`, `InfiniteSentinel`, `PageStateBoundary`, `PromptEditorField`, `PromptEditorOverlay`,
`PromptField`, `PromptOrderEditor`, `RpText`, `SectionActions`, `SegmentedToggle`, `TokenBudgetBar`,
`TranslateActionMenu`, `TranslateSheet`.
Не трогать: `ExpandableSelect`, `LangPicker`, `PageTransition`, `SectionWithFooter` (без своего `.css`).

### `webapp/src/features/characters/components/`
`CharacterAvatar` (.tsx+.css) вперемешку с `CharacterForm.tsx`, `FirstMessagesEditor.tsx`, `TagsInput.tsx`.

### `webapp/src/features/narrator/components/`
`StoryCard` (.tsx+.css) вперемешку с `BeatDivider.tsx`, `CompactSettingsSection.tsx`,
`StoryHeader.tsx`, `StoryInput.tsx`, `StoryMessageItem.tsx`.

### `webapp/src/features/personas/components/`
`PersonaAvatar` (.tsx+.css) вперемешку с `PersonaForm.tsx`.

### `webapp/src/features/rp-chat/components/`
`ChatCard` (.tsx+.css) вперемешку с `ChatHeader.tsx`, `ChatInput.tsx`, `ImpersonateSheet.tsx`,
`ImpersonateVariantCard.tsx`, `InputActionsMenu.tsx`, `MessageBubble.tsx`, `StreamingBubble.tsx`.

## Не нарушают (не трогать)

`bot/src/server/{rp-templates,narrator-templates,personas,presets,characters,books,me}` — одна
сущность на папку + `index.ts`, уже соответствует правилу. `bot/src/llm/`, `bot/src/utils/`,
части `bot/src/db/` — модули однофайловые. `bot/src/server/stories/` и `bot/src/server/chats/` —
`*.controller.ts`+`*.types.ts` это 1 компаньон сверх основного, не 2 — порог не достигнут.

## Шаги на сущность

1. Создать подпапку `EntityName/` рядом со старыми файлами.
2. Перенести `EntityName.ts(x)`, `EntityName.constants.ts`, `EntityName.types.ts`, `EntityName.css`,
   `EntityName.test.ts(x)` (что применимо) в неё без переименования.
3. Добавить `index.ts`, реэкспортирующий публичную поверхность (то, что реально импортируют извне).
4. Поправить импорты у потребителей на путь до подпапки (barrel), а импорты **внутри** сущности
   между её файлами — напрямую к файлам, не через свой же `index.ts` (см. правило в CLAUDE.md про
   циклы через собственный barrel).
5. Для `bot/`: не забыть `.js`-расширения в относительных импортах (native ESM).
6. Для `webapp/`: импорт CSS остаётся относительным путём внутри новой подпапки (`./EntityName.css`).

## Порядок и гейт

- Разносить можно по одной папке за раз, отдельными коммитами (`refactor(<scope>): разнести <папку>
  по сущностям`), чтобы диффы были маленькими и просматриваемыми.
- После каждой папки — `yarn build` (быстрая проверка, что импорты не сломаны) — компиляция должна
  остаться чистой, поведение не меняется.
- Перед финальным коммитом/деплоем — обязательный гейт `test-runner` (`yarn test` + `yarn build`)
  per CLAUDE.md.
- Чисто структурный рефакторинг — ручное тестирование в браузере не требуется (UI/API не меняются),
  но если задеты компоненты webapp — стоит один раз открыть Mini App и проверить, что затронутые
  экраны рендерятся без ошибок в консоли.

## После выполнения

Когда все папки из списка выше разнесены — удалить этот файл (задача одноразовая, инструкция после
выполнения не нужна).
