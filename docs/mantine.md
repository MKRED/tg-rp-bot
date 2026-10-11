# Mantine в webapp

Webapp переезжает с tgui на Mantine (`@mantine/core`, `@mantine/hooks`, `@mantine/notifications`,
версии закреплены точно) — экран за экраном, план и статус — [plan/mantine.md](plan/mantine.md).
Здесь — как устроено и как писать новые экраны.

## Подключение

- `main.tsx` импортирует `@mantine/core/styles.layer.css` и `@mantine/notifications/styles.layer.css` —
  стили Mantine в CSS-слоях (`@layer`). Неслоёные стили (tgui, `index.css`, наши `.module.css`)
  всегда сильнее: пока рядом живёт tgui, reset Mantine её экраны не меняет, а свои модули перекрывают
  Mantine без `!important`. Два глобальных правила Mantine всё же доставали до tgui — `font: inherit` у
  полей/кнопок и `-webkit-font-smoothing: antialiased` на body; `index.css` возвращает им прежнее
  поведение до удаления tgui.
- `App.tsx`: `MantineProvider` (тема, `cssVariablesResolver`, `forceColorScheme` из `ThemeProvider`)
  → `MotionConfig reducedMotion="user"` → `AppRoot` tgui. Mantine снаружи `AppRoot`: её порталы
  (Modal, Drawer, Select, тосты) уходят в `body` и берут тему из контекста.
- `webapp/postcss.config.cjs`: `postcss-preset-mantine` (`light-dark()`, `rem()`, миксины) и
  `postcss-simple-vars` (переменные брейкпоинтов `$mantine-breakpoint-*`).

## Тема — `webapp/src/shared/theme/`

| Файл | Что |
|---|---|
| `palettes.ts` | Палитры (`PALETTES`: нейтральная, янтарная, фиолетовая, бирюзовая; по умолчанию — `DEFAULT_PALETTE`): кортежи `accent` (primary), `gray`, `dark` + `surfaces` (фон страницы и карточек по схемам). Новая палитра — объект + строка в `PALETTES`, в выборе появится сама |
| `fonts.ts` | Пары шрифтов (`FONT_PAIRS`: системный — как был у tgui, Manrope + Lora, Onest; по умолчанию — `DEFAULT_FONT_PAIR`). `loadFontPair` подключает `<link>` Google Fonts только для выбранной пары |
| `cssVariables.ts` | `buildCssVariablesResolver(surfaces)`: `--mantine-color-body` (карточки), `--app-color-page` (фон страницы), `--app-shadow-card` (тень карточки), `--app-color-divider` (линии внутри карточек) для светлой и тёмной схемы |
| `motion.ts` | Длительность и кривая анимаций — общие для framer-motion и переходов Mantine |
| `theme.ts` | `buildTheme(palette, fonts)` → `createTheme`: цвета, `primaryShade`, `autoContrast`, радиусы (поля/кнопки 12px, карточки 16px), `respectReducedMotion`, `defaultProps` (поля `filled` и кнопки `size="md"` высотой 44px, `Paper` без рамки с тенью, переходы оверлеев) |
| `ThemeProvider.tsx` | Режим `system \| light \| dark` (system — `themeParams.isDark`, тема самого Telegram; не `miniApp.isDark` — тот считается по фону Mini App, который красит `useTelegramChrome`), палитра и пара шрифтов. Всё — выбор пользователя в «Настройки → Оформление» (`ThemeToggle`, `PalettePicker`, `FontPicker`), хранится в localStorage; `App` пересобирает тему Mantine без перезагрузки |

Свои CSS-переменные — с префиксом `--app-`. `font-family` нигде, кроме `fonts.ts`, не пишется
(исключение — превью пар в `FontPicker`: каждый вариант набран своей парой из `FONT_PAIRS`).

**Карточки без рамок.** `withBorder` у `Paper` не ставим: в светлой схеме карточку отделяет тень, в
тёмной — поверхность светлее фона (`--app-shadow-card`). Линии внутри карточки — `--app-color-divider`.

## Каркас экрана

- **`AppPage`** (`shared/components/AppPage`) — обязательная обёртка экрана: фон страницы, отступы
  safe area (Full Screen), колонка шириной до 680px по центру, заголовок, общий лоадер (`loading`),
  анимация появления (`PageTransition`) и цвет шапки/фона Telegram под палитру (`useTelegramChrome`;
  на размонтировании возвращает цвета темы клиента — для экранов ещё на tgui). `width` — уже колонка
  (форма входа), `centered` — контент по центру экрана по вертикали.
- **`NavList` + `NavItem`** — меню переходов (главная): подпись группы, карточка со строками «иконка —
  название — подпись — шеврон», неактивный пункт `soon` с бейджем «Скоро»; `index` — сквозной номер
  строки для поочерёдного появления.
- **`ChoiceCard`** — вариант в выборе «один из нескольких» с визуальным превью (палитра, шрифт):
  выбранный обведён акцентом с галочкой, роль `radio`; группа — через `useChoiceGroup` (radiogroup,
  в Tab-порядке только выбранный, стрелки/Home/End выбирают соседний).
- **`SettingsCard`** — карточка группы полей: заголовок, пояснение, поля столбиком.
- **`ResponsiveSheet`** — выбор/действия поверх экрана: шторка снизу на телефоне, окно по центру на
  широком экране (граница — брейкпоинт `sm`, 48em).
- **`InfoRow`** — строка «название — значение» только для чтения с пояснением.
- **`ApiKeyField`** — поле персонального ключа API с условной кнопкой сохранить/удалить.
- **Тосты** — прежний `useToast().showToast({ message, type })`, внутри `@mantine/notifications`
  (снизу по центру, один за раз, поверх лайтбокса).

## Стили

- `Component.module.css` рядом с компонентом, классы в camelCase: `styles.messageList`. Компонент с
  модулем — это уже entity-папка (`Component/Component.tsx` + `.module.css` + `index.ts`).
- Глобально — только `index.css` и тема. Старый `.css` экрана удаляется при переезде целиком.
- Цвета, отступы, радиусы, шрифты — только переменными: `var(--mantine-color-body)`,
  `var(--mantine-color-dimmed)`, `var(--mantine-spacing-md)`, `var(--mantine-radius-md)`,
  `var(--app-color-page)`; разные значения по схемам — `light-dark(a, b)`.
- Внутренности компонентов Mantine — через `classNames={{ body: styles.x }}`, не через глобальные
  селекторы `.mantine-…`.

## Телефон и ПК

- Mobile-first: базовые стили — для узкого экрана, широкий — `@media (min-width: $mantine-breakpoint-sm)`.
- Цели нажатия не мельче 44px: у кнопок и полей `md` высота поднята до 44px в `theme.ts` (у Mantine — 42px); `SegmentedControl md` — 41px; иконки-кнопки внутри поля (`ActionIcon` в `rightSection`) меньше — их целью считается поле. Действий только на hover нет.
- Поля ввода 16px (`size="md"` по умолчанию в теме) — иначе iOS зумит страницу на фокусе.
- Списки на телефоне в одну колонку; карточки/галереи на широком экране — `SimpleGrid cols={{ base: 1, sm: 2 }}`.
- Проверка экрана в Playwright: 390×844 и 1280×800, светлая и тёмная схема.

## Анимации

- Переходы страниц, списки, раскрытие, перестановка — `framer-motion` с `MOTION_TRANSITION` из
  `motion.ts`. Раскрытие блока по условию — `AnimatePresence initial={false}` + анимация высоты.
- Оверлеи (`Modal`, `Drawer`, `Popover`, `Menu`, `Tooltip`, выпадающие списки) анимирует Mantine —
  поверх них свои анимации не пишем.
- Системное «уменьшить движение» отключает и то и другое (`MotionConfig`, `respectReducedMotion`).
