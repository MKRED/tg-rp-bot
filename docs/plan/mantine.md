# План: переезд webapp с tgui на Mantine и CSS-модули

Две задачи, которые делаются вместе:

| # | Задача |
|---|---|
| 1 | Заменить `@telegram-apps/telegram-ui` (tgui) на **Mantine** — та же библиотека, что в `D:\GitProject\dnd-online` (`apps/web`) |
| 2 | Перевести стили с глобальных `.css` на `.module.css` |

**Почему меняем:** в tgui много визуальных багов (прозрачный фон Modal из-за портала вне `AppRoot`,
оверлеи Switch/Cell перехватывают клики), и библиотеку больше не развивают. Вокруг неё накопились
костыли: ручной оверрайд темы через `initial !important` (`manualTheme.css`), вложенные `AppRoot` в
порталах (`PromptEditorOverlay`, `ImageCropEditor`), самописные дропдауны и шторки.

**Почему вместе:** 36 из 43 CSS-файлов опираются на переменные tgui (`var(--tgui--hint_color)` и т.п.)
и подогнаны под её разметку. Перевести их в модули, оставив tgui, — значит переписать стили дважды.
Mantine сама построена на CSS-модулях и CSS-переменных (`classNames` + `.module.css` — её штатный
способ кастомизации), поэтому экран переезжает на Mantine и **в том же шаге** его стили становятся
модулем.

## Исходное состояние

- tgui импортируют 105 из 115 `.tsx`. Чаще всего: `Spinner` 44, `Cell` 38, `Button` 36,
  `Text`/`Caption` по 32, `Section` 31, `List` 26, `Input` 14, `Switch` 12, `Banner` 9, `Modal` 6;
  ещё ~20 компонентов по 1–4 раза.
- CSS: 43 файла, ~3900 строк, модулей нет. Крупнейшие: `rp-chat.css` 676, `narrator.css` 337,
  `presets.css` 270, `cards.css` 232.
- Тема: `shared/theme/ThemeProvider.tsx` — режим `system | light | dark` (system = `miniApp.isDark`
  из Telegram, ручной выбор в `localStorage`), `ThemeToggle` в настройках; `init.ts` биндит
  `themeParams`/`miniApp`/`viewport` в CSS-переменные.

## Решения

- **Свои цвета, без моста из темы Telegram.** Светлая и тёмная палитры задаются в файлах темы, как в
  dnd-online: `webapp/src/shared/theme/palettes.ts` (кортежи `MantineColorsTuple`), `theme.ts`
  (`createTheme`: primary, radius, шрифт, цвета), `cssVariables.ts` (`cssVariablesResolver` —
  фон/текст/рамки для каждой схемы). Поменять цвет = поправить один файл. Отличие от текущих цветов —
  не проблема, подстроим позже.
- **Светлая/тёмная схема остаётся** с тем же выбором `system | light | dark`: в режиме system схема
  берётся из `themeParams.isDark` (не `miniApp.isDark` — тот зависит от фона, который мы перекрашиваем), иначе — ручной выбор. ThemeProvider управляет схемой Mantine
  (`forceColorScheme` / `useMantineColorScheme`) вместо `appearance` у `AppRoot`.
- **Шапка и фон Telegram под нашу палитру.** Раз цвета больше не из `themeParams`, вызываем
  `miniApp.setHeaderColor` / `setBackgroundColor` (и `setBottomBarColor`, если доступен) с цветами
  текущей схемы — иначе шапка Telegram будет одного цвета, а приложение другого.
- **Экраны переосмысляем, а не переносим.** Сохраняется смысл и функциональность страницы, а не
  разметка tgui. Костыли под tgui не переносим. Перед переделкой экрана составляем чек-лист его функций
  (что можно сделать, какие состояния: загрузка, пусто, ошибка, нет ключа), после — сверяем по нему.
- **Понемногу, как с бэкендом.** Один блок — один экран (или пара маленьких) плюс нужные ему общие
  компоненты. Между блоками прод работает, tgui и Mantine живут рядом до конца переезда.
- **Стили:** `Component.module.css` рядом с компонентом, имена классов в camelCase
  (`styles.messageList`). Глобальный CSS — только `index.css` (reset/body) и файлы темы. Цвета
  и отступы — через переменные Mantine (`var(--mantine-color-body)`, `var(--mantine-spacing-md)`,
  `light-dark()` из `postcss-preset-mantine`), не хардкод.
- **Палитра и шрифты — выбор пользователя** (шаг 1.5): несколько палитр (`palettes.ts`) и пар шрифтов
  (`fonts.ts`, Google Fonts с кириллицей, системный — как у tgui) в «Настройки → Оформление». Семейства
  задаются только в `fonts.ts`; CSS-модули — через `var(--mantine-font-family)` /
  `var(--mantine-font-family-headings)`, никаких `font-family` в компонентах. Детали — `docs/mantine.md`.
- **Сначала телефон, но и на ПК прилично.** Основной сценарий — Mini App на телефоне (ширина
  ~360–430px), поэтому вёрстка mobile-first: базовые стили — для узкого экрана, широкий — через
  `@media (min-width: $mantine-breakpoint-sm)` / `md` (переменные брейкпоинтов из `postcss-simple-vars`,
  как в dnd-online). Правила:
  - **Ширина контента ограничена** общим контейнером страницы (`Container size` ≈ 640–720px по центру):
    на ПК и в Telegram Desktop экран не растягивается на всю ширину, на телефоне — от края до края с
    боковыми отступами.
  - **Цели нажатия ≥ 44px** по высоте, без действий только на hover (на телефоне hover нет); hover —
    лишь визуальная подсказка для мыши.
  - **Шторки снизу на телефоне, окна на ПК:** выбор/действия — `Drawer position="bottom"` на узком
    экране, `Modal` по центру на широком (общий компонент-обёртка `ResponsiveSheet` поверх
    `useMediaQuery`), чтобы не получить шторку на весь монитор.
  - **Списки и сетки:** на телефоне — одна колонка; на широком экране карточки/галереи могут идти в
    2–3 колонки (`SimpleGrid cols={{ base: 1, sm: 2 }}`).
  - **Поля ввода** не мельче 16px (иначе iOS зумит страницу при фокусе).
  - **Клавиатура и safe area** — по-прежнему через viewport SDK (`docs/telegram-ui.md`); в браузере
    вне Telegram — `env(safe-area-inset-*)`.
  - **Проверка каждого экрана** в Playwright на двух ширинах: телефон (390×844) и ПК (1280×800).
- **Анимации в итоговом результате обязательны.** Что есть сейчас:
  - переходы между страницами — `AnimatedRoutes` (`AnimatePresence mode="wait"`) + `PageTransition`
    (появление снизу с прозрачностью, ~0.2с);
  - `framer-motion` ещё примерно в 40 файлах (~78 `motion.div`): появление/исчезновение элементов
    списков, раскрытие блоков форм (`LlmSettingsSection`, `EntryEditor`, `FirstMessagesEditor`,
    `CardForm`), перестановка порядка (`CategoryOrderList`, `PromptOrderEditor`), смена аватаров,
    шторки, лайтбокс, обрезка;
  - CSS: `@keyframes` в `rp-chat.css`, `DropdownPicker.css`, `LangPicker.css`, ~20 `transition`.

  Как переносим:
  - **`framer-motion` остаётся** для переходов страниц, списков, раскрытия и перестановки — Mantine
    это не заменяет. Оверлеи (`Modal`, `Drawer`, `Popover`, `Menu`, `Combobox`) анимирует сама
    Mantine — свои анимации поверх них не пишем; простое раскрытие можно отдать `Collapse` Mantine.
  - **Общие длительности и кривые** — в одном файле `shared/theme/motion.ts` (сейчас 0.2с и
    `[0.22, 1, 0.36, 1]` разбросаны по компонентам); их же получают переходы Mantine через
    `defaultProps` в `theme.ts`, чтобы оверлеи и страницы двигались в одном темпе.
  - **Уважаем `prefers-reduced-motion`:** `MotionConfig reducedMotion="user"` для framer-motion и
    `respectReducedMotion` в теме Mantine.
  - **Переходы страниц работают с шага 0:** `AnimatedRoutes`/`PageTransition` от tgui не зависят и
    оборачивают все экраны, переехавшие и нет.
  - **Анимации внутри экрана можно доделывать поэтапно.** Если анимация мешает переделке экрана, экран
    можно выкатить без неё, но в чек-листе функций экрана анимации — отдельные пункты, а пропущенные
    записываются в «Долг по анимациям» ниже. Долг закрывается до шага 8; шаг 8 без пустого долга не
    начинаем.
- **Сначала компоненты Mantine.** Нет подходящего — свой компонент в `shared/components/` поверх
  примитивов Mantine (`Paper`, `UnstyledButton`, `Group`, `Stack`) с `.module.css`.
- **Остаются:** `@telegram-apps/sdk-react` (initData, BackButton, viewport, safe area, haptics),
  `lucide-react` (иконки), `framer-motion`, `@xyflow/react`, `react-easy-crop`, `react-zoom-pan-pinch`.

## Соответствие компонентов (ориентир, не правило)

| tgui | Mantine |
|---|---|
| `Spinner` | `Loader` (страничный — свой `PageLoader`) |
| `Button`, `IconButton` | `Button`, `ActionIcon` |
| `Text`, `Caption`, `Subheadline`, `Title` | `Text` (`size`, `c="dimmed"`), `Title` |
| `Section`, `List`, `Cell`, `ButtonCell` | `Paper`/`Card` + `Stack`, `NavLink`, `UnstyledButton`; общий `Section` — только если повторяется паттерн |
| `Input`, `Textarea`, `FileInput` | `TextInput`, `PasswordInput`, `Textarea` (`autosize`), `FileInput`/`FileButton` |
| `Switch`, `Checkbox`, `Slider` | `Switch`, `Checkbox`, `Slider` |
| `Multiselect` | `MultiSelect`, `TagsInput` |
| `Modal` | `Modal`, `Drawer position="bottom"` (шторки) |
| `Snackbar` | `@mantine/notifications` (под `useToast`) |
| `Banner`, `Info`, `Placeholder` | `Alert`, свой `EmptyState` |
| `Accordion`, `Tooltip`, `Divider`, `Avatar` | одноимённые |
| свой `DropdownPicker`, `SegmentedToggle` | `Select`/`Combobox`, `SegmentedControl` |

## Шаги

| Шаг | Что | Статус |
|---|---|---|
| 0 | Фундамент + экран настроек | сделано |
| 0.5 | Экран входа — отдельный маршрут `/login` (с возвратом по `?from=`) на Mantine | сделано |
| 1 | Главная | сделано |
| 1.5 | Оформление: карточки без рамок, крупнее радиусы; выбор палитры и шрифтов в настройках | сделано |
| 2 | Простые списки: персоны, RP-шаблоны, шаблоны рассказчика | сделано |
| 3 | Персонажи, debug | — |
| 4 | Пресеты генерации, книги знаний | — |
| 5 | Карточки | — |
| 6 | RP-чат | — |
| 7 | Рассказчик | — |
| 8 | Удаление tgui | — |

Порядок — от простого к сложному: на маленьких экранах устоится набор общих компонентов, к RP-чату
(~2200 строк tsx, 680 строк CSS) и рассказчику (~2450 / 350) подходим с готовым набором. Общий
компонент (`DropdownPicker`, `TranslateSheet`, `PromptEditorOverlay`, `ImageCropEditor`,
`AvatarPicker`…) переезжает вместе с первым экраном, которому он нужен; ещё не переехавшие экраны,
где он используется, проверяем в том же блоке — две версии одного компонента не держим.

## Шаг 0 — фундамент + экран настроек

**Зависимости:** `@mantine/core`, `@mantine/hooks`, `@mantine/notifications` (версия — как в
dnd-online, `^9.5`); dev: `postcss`, `postcss-preset-mantine`, `postcss-simple-vars` +
`webapp/postcss.config.cjs` (как в dnd-online). `@mantine/form` — не сразу: подключим, если на
каком-то экране он упростит форму.

**Работа:**
1. Файлы темы `shared/theme/palettes.ts`, `theme.ts`, `cssVariables.ts`, `fonts.ts`, `motion.ts` — нейтральная
   палитра для светлой и тёмной схем, системный шрифт, место под `<link>` Google Fonts в `index.html`.
   Общий контейнер страницы с ограничением ширины и `ResponsiveSheet` (шторка/окно).
2. `MantineProvider` в `App.tsx` **снаружи** `AppRoot` (порталы Mantine в `body` получают тему через
   контекст), `Notifications`. ThemeProvider: одна схема на обе библиотеки — `appearance` для
   `AppRoot` и `forceColorScheme` для Mantine.
3. Цвета шапки/фона Telegram из нашей палитры при смене схемы.
4. **Проверить соседство стилей:** `@mantine/core/styles.css` и `@telegram-apps/telegram-ui/dist/styles.css`
   оба глобальные — не сломал ли reset Mantine экраны на tgui (шрифты, `box-sizing`, отступы body).
   Если ломает — подключать стили Mantine покомпонентно (`@mantine/core/styles/*.css`) без
   глобального baseline до шага 8.
5. `useToast` поверх `@mantine/notifications` (API `showToast({ message })` не меняется — 13
   потребителей остаются как есть).
6. Экран настроек (`pages/settings` + `features/llm-settings`, `tavily-settings`, `translate-settings`,
   `auth/BrowserLoginSection`, `ThemeToggle`) — переосмыслить на Mantine, стили в модули.
7. CLAUDE.md: правило «tgui first» → «Mantine first, стили в `.module.css`» (для нового и
   переделываемого кода); `docs/mantine.md` — краткий справочник: тема, где палитры, конвенции стилей,
   типовые паттерны экранов, как подключить Google Fonts, правила телефон/ПК.

**Как сделано (отличия от исходного плана):**
- Соседство стилей решено слоями: `@mantine/core/styles.layer.css` — reset Mantine в `@layer`,
  неслоёная tgui сильнее. Проверено сравнением computed-стилей с отключёнными стилями Mantine на всех
  экранах tgui (главная, списки, формы создания). Два глобальных правила Mantine всё же меняли tgui —
  `font: inherit` у полей/кнопок и `antialiased` на body; `index.css` их нейтрализует (убрать на шаге 8),
  после этого отличий нет.
- Шапку/фон Telegram красит `AppPage` (`useTelegramChrome`), а не корень приложения: на
  размонтировании возвращает цвета темы клиента, чтобы экраны на tgui остались в своих цветах. Фон
  `body` (ThemeProvider + `index.css`) не трогали до шага 8 — `AppPage` сам красит фон на всю высоту.
- В настройках общие tgui-компоненты (`SegmentedToggle`, `ExpandableSelect`, `DropdownPicker`) не
  переделывались — у них есть другие потребители; на экране настроек их заменили `SegmentedControl` и
  `Select` Mantine прямо на месте. `PromptEditorField` (свой промпт перевода) на шаге 0 оставался на
  tgui; переведён на шаге 2.
- Новые общие компоненты: `AppPage`, `SettingsCard`, `ResponsiveSheet` (пока без потребителей),
  `InfoRow`, `ApiKeyField`; `useToast` — на `@mantine/notifications`.

**Проверка:** Playwright локально (светлая и тёмная схема, 390×844 и 1280×800), остальные
экраны на tgui не поплыли; владелец смотрит в настоящем Telegram (iOS/Android/Desktop) — шапка,
safe area, клавиатура в полях ввода. **Это контрольная точка:** если вид в Telegram не устраивает,
откатываем шаг 0 до того, как переделано что-то ещё.

## Шаг 2 — как сделано

- **Общие компоненты:** `ListCard`/`ListRow` (обобщение `NavList`/`NavItem` главной), `ListPage`
  (хаб списка), `EmptyState`; у `AppPage` — `description` и `actions`.
- **Переехали раньше плана,** потому что нужны этим формам: `PromptEditorField` (только превью-поле;
  полноэкранный `PromptEditorOverlay` остаётся на tgui до шага 7), `PromptOrderEditor`, `AvatarPicker`,
  `DeleteButton`, внутренний аватар `PersonaAvatar`/`CharacterAvatar` (инициалы в цвете палитры).
  На экранах tgui проверены в форме персонажа; гуттер tgui — через `--app-legacy-field-padding`.
  Класс `.delete-button` из `index.css` удалён.
- **Отличия от старых экранов:** страница списка скроллится целиком (не внутренний скролл с прибитой
  кнопкой), «Создать» — в шапке; формы шаблонов разложены по карточкам; ошибка сохранения и удаления
  шаблона теперь показывает тост (раньше — молча).

## Шаги 1–7 — экраны

Одинаковый порядок на каждый блок:
1. Чек-лист функций экрана по текущему коду (действия, состояния, deep-link'и, BackButton, анимации).
2. Новый UI на Mantine; общие компоненты — в `shared/components/` с `.module.css`.
3. Старый `.css` экрана удаляется целиком (не остаётся рядом с модулем).
4. Сверка по чек-листу в Playwright (обе схемы, телефон 390×844 и ПК 1280×800), `yarn test`, сборка.
5. Коммит → по просьбе деплой → владелец проверяет в Telegram.

Особое внимание:
- **Шаг 5, карточки:** обрезка аватара (`ImageCropEditor` — сейчас свой `AppRoot` в портале),
  лайтбокс.
- **Шаг 6, RP-чат:** длинный список сообщений с виртуализацией (`useRenderWindow`), поле ввода над
  клавиатурой и safe area, long-press меню, перевод (`TranslateSheet`), стриминг.
- **Шаг 7, рассказчик:** граф (`@xyflow/react`) — свои стили библиотеки остаются, наш CSS вокруг —
  в модуль; `PromptEditorOverlay` (сейчас вложенный `AppRoot`).

## Идеи на потом

Не в шагах плана — вернуться, когда переезд устоится.

- **Главная, крупные плитки режимов.** Режимы игры (RP-чат, рассказчик) — большими плитками с иконкой
  и описанием вместо строк списка; остальные разделы остаются списком.
- **Главная, свой цвет у раздела.** Иконки каждого раздела в своём оттенке (из палитры, не хардкод) —
  легче находить взглядом.
- **Вибрация при нажатии.** Лёгкий haptic feedback Telegram (`hapticFeedback.impactOccurred("light")`)
  на пунктах меню и основных кнопках; вне Telegram — ничего.

## Долг по анимациям

Анимации, которые экран временно потерял при переезде (экран, что за анимация, где была). Пусто —
долга нет.

- —

## Шаг 8 — удаление tgui

- **Условие начала:** «Долг по анимациям» пуст.

- Убрать `AppRoot`, пакет `@telegram-apps/telegram-ui`, `manualTheme.css` и связанные с tgui ветки
  ThemeProvider, бинды `themeParams.bindCssVars()` в `init.ts`, если переменные `--tg-theme-*` больше
  нигде не читаются.
- Включить глобальные стили Mantine целиком, если на шаге 0 их подключали покомпонентно.
- Убрать из `index.css` нейтрализацию глобальных правил Mantine (`font: revert` у полей/кнопок,
  `-webkit-font-smoothing: auto` на body), `.section-blend-inputs`, `.section-note`;
  переменную `--app-legacy-field-padding` (гуттер tgui у общих полей — `AppPage`, `PromptEditorField`,
  `AvatarPicker`).
- Удалить `docs/tgui-components.md`; `docs/telegram-ui.md` оставить только про SDK, viewport, safe area
  и платформы (или слить в `docs/mantine.md`); убрать из памяти заметки про баг Modal и force-click
  в Playwright.
- Этот план — удалить или отметить выполненным.
