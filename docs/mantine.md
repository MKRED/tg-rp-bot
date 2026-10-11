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
| `palettes.ts` | Цвета: кортежи `accent` (primary), `gray`, `dark` + `surfaces` (фон страницы и карточек по схемам). Поменять цвета — только здесь |
| `cssVariables.ts` | `--mantine-color-body` (карточки, поля) и `--app-color-page` (фон страницы) для светлой и тёмной схемы |
| `fonts.ts` | Семейства шрифтов (текст, заголовки). Сейчас системный стек |
| `motion.ts` | Длительность и кривая анимаций — общие для framer-motion и переходов Mantine |
| `theme.ts` | `createTheme`: цвета, шрифты, радиус, `respectReducedMotion`, `defaultProps` (поля и кнопки `size="md"` высотой 44px, переходы оверлеев) |
| `ThemeProvider.tsx` | Режим `system | light | dark` (system — `miniApp.isDark` Telegram), одна схема на tgui и Mantine |

Свои CSS-переменные — с префиксом `--app-`.

**Подключить шрифт из Google Fonts:** раскомментировать `<link>` в `webapp/index.html` (семейство с
кириллицей, `display=swap`) и поставить имя семейства первым в стеке в `fonts.ts`. Больше нигде
`font-family` не пишется.

## Каркас экрана

- **`AppPage`** (`shared/components/AppPage`) — обязательная обёртка экрана: фон страницы, отступы
  safe area (Full Screen), колонка шириной до 680px по центру, заголовок, общий лоадер (`loading`),
  анимация появления (`PageTransition`) и цвет шапки/фона Telegram под палитру (`useTelegramChrome`;
  на размонтировании возвращает цвета темы клиента — для экранов ещё на tgui).
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
