# Telegram Mini App — платформы, режимы, viewport

Как webapp ведёт себя в разных клиентах и режимах открытия Mini App: тема клиента, платформа,
Full Screen, viewport и safe area. UI — на Mantine, его соглашения — [mantine.md](mantine.md).

**Стек, к которому относится документ:**

| Пакет | Версия в проекте | Роль |
|---|---|---|
| [`@telegram-apps/sdk-react`](https://www.npmjs.com/package/@telegram-apps/sdk-react) | `3.3.9` | Доступ к Telegram WebApp (тема, viewport, платформа, safe area) |

Где это в коде:
- Инициализация SDK — [webapp/src/init.ts](../webapp/src/init.ts)
- Определение платформы — [webapp/src/shared/telegram/platform.ts](../webapp/src/shared/telegram/platform.ts)
- Порядок запуска — [webapp/src/main.tsx](../webapp/src/main.tsx)
- Тема и цвет шапки Telegram — [webapp/src/shared/theme/ThemeProvider.tsx](../webapp/src/shared/theme/ThemeProvider.tsx),
  [webapp/src/shared/telegram/useTelegramChrome.ts](../webapp/src/shared/telegram/useTelegramChrome.ts)

> ⚠️ Версии в этом файле — справочные на момент написания. Источник правды — `webapp/package.json`.
> Перед обновлением SDK сверяйтесь с официальными доками (ссылки в конце).

---

## 1. Тема клиента и цвета Telegram

- **Схема (светлая/тёмная)** — из `useTheme()` (`shared/theme`): в режиме «Авто» — сигнал
  `themeParams.isDark` (по фону темы самого Telegram, реагирует на смену темы без перезагрузки), иначе —
  ручной выбор пользователя из настроек (localStorage). Схема уходит в `MantineProvider`
  (`forceColorScheme`) — ручная тема работает и внутри настоящего Telegram.
- **`themeParams.isDark`, а не `miniApp.isDark`:** второй считается по фону Mini App, который мы сами
  красим под палитру, — «Авто» после «Светлой» видело бы свой же светлый фон.
- **Цвета клиента (`--tg-theme-*`) не используем** — все цвета даёт палитра Mantine (`shared/theme`).
  `themeParams.bindCssVars()`/`miniApp.bindCssVars()` не вызываются.
- **Шапка и фон Telegram** — `useTelegramChrome` в корне (`App.tsx`) красит их в цвет страницы палитры
  (`miniApp.setHeaderColor`/`setBackgroundColor`, под `isAvailable()`): иначе над палитрой висела бы шапка
  цвета темы клиента, а в Full Screen иконки статус-бара сливались бы с фоном.
- **Нативные попапы** (`popup.open`, подтверждения) рисует сам Telegram — в теме клиента, не палитры.

---

## 2. Телефон vs Компьютер (mobile vs desktop)

Платформа клиента приходит в launch-параметре `tgWebAppPlatform` и **за сессию не меняется**
(читаем один раз — [webapp/src/shared/telegram/platform.ts](../webapp/src/shared/telegram/platform.ts)).

| Группа | Значения `tgWebAppPlatform` |
|---|---|
| Мобильные | `android`, `android_x`, `ios` |
| Десктоп | `macos`, `tdesktop`, `unigram` |
| Веб-клиенты | `webk`, `weba`, `web` |

```ts
// platform.ts — гейтим фичи по мобильности
const MOBILE_PLATFORMS = new Set(["android", "android_x", "ios"]);
export function isMobilePlatform(): boolean {
  return MOBILE_PLATFORMS.has(getPlatform());
}
```

### 2.1. Что есть только на мобильных

| Возможность | API (SDK / WebApp) | На десктопе |
|---|---|---|
| Тактильная отдача (haptics) | `hapticFeedback.*` | молча игнорируется |
| Биометрия | `BiometricManager` | нет |
| Сенсоры (акселерометр, гироскоп, ориентация) | соответствующие компоненты SDK | нет |
| Геолокация | `LocationManager` | нет |
| Ярлык на домашний экран | `addToHomeScreen()` | нет |
| Настоящий Full Screen (поверх статус-бара) | `viewport.requestFullscreen()` | лишь растягивает окно |
| Значимые safe-area insets | `safeAreaInset` / `contentSafeAreaInset` | обычно нули |

### 2.2. Поведение окна

- **Мобильный**: Mini App открывается в нативном BottomSheet — выезжает снизу, стартует на части
  высоты, тянется вверх свайпом или `viewport.expand()`. Свайп по **шапке** всегда закрывает/сворачивает
  приложение (это не отключается).
- **Десктоп** (`tdesktop`, `macos`): Mini App в окне фиксированного размера. Нет BottomSheet, нет
  свайпов; `expand()` максимизирует окно. `requestFullscreen()` просто разворачивает окно на весь
  экран и не убирает интерфейс Telegram — поэтому **на десктопе Full Screen нам не нужен**.

### 2.3. Рекомендации

- **Full Screen — только на мобильных.** Гейтим и по платформе, и по `isAvailable()`, отказ глотаем
  ([webapp/src/init.ts](../webapp/src/init.ts)):

  ```ts
  if (isMobilePlatform() && viewport.requestFullscreen.isAvailable()) {
    viewport.requestFullscreen().catch(() => {});
  }
  ```

- **Любой mobile-only вызов — через `isAvailable()`-гард** (haptics, биометрия и т. д.): SDK не бросит,
  но платформа может проигнорировать.
- **Safe area — с фоллбэком `0px`** (на десктопе нули): см. раздел 3.4.

---

## 3. Режимы открытия и отображения Mini App

### 3.1. Контексты запуска

Mini App может открываться по-разному, и от контекста зависит доступный набор возможностей:

1. **Main Mini App** — кнопка в профиле бота или `https://t.me/<bot>?startapp=...`. Полный доступ.
2. **Keyboard-кнопка** (`web_app`) — может слать данные боту через `sendData()`, но без `query_id`.
3. **Inline-кнопка** — есть `query_id`, доступен `answerWebAppQuery()`; нет `sendData()`.
4. **Menu-кнопка** — быстрый доступ из чата; по возможностям как inline.
5. **Inline-режим** — кнопка «Switch to Mini App» в inline-результатах.
6. **Прямая ссылка** — `https://t.me/<bot>/<app>?startapp=<param>`; кастомная строка приходит в
   `tgWebAppStartParam`.
7. **Меню вложений (attachment menu)** — после явного разрешения пользователя.

> В этом проекте есть deep-link из бота: web_app-кнопка под фото открывает Mini App с `?dl=<путь>`,
> и `resolveDeepLink()` переписывает hash на нужный маршрут **до** старта роутера
> ([webapp/src/main.tsx](../webapp/src/main.tsx)). Это про роутинг, а не про режим отображения, но
> относится к тому же набору launch-параметров.

### 3.2. Compact vs Full Screen

- **Compact** — приложение открывается на половине высоты (свёрнутый BottomSheet). Включается
  параметром `&mode=compact` в ссылке запуска. Пользователь всегда может растянуть вверх.
- **Full Screen** (Bot API 8.0 / Mini Apps v8.0) — `viewport.requestFullscreen()` /
  `viewport.exitFullscreen()`. На мобильных убирает верхнюю/нижнюю панели Telegram, приложение
  занимает весь экран (включая зону статус-бара). Подходит для игр/медиа.
  - `viewport.isFullscreen()` — сигнал (boolean).
  - События: `fullscreenChanged` при успехе; `fullscreenFailed` (`UNSUPPORTED` / `ALREADY_FULLSCREEN`) при отказе.
  - В Full Screen имеет смысл задать цвет шапки/статус-бара (`setHeaderColor()`), иначе иконки статус-бара
    могут сливаться с фоном.
  - Стартовое состояние видно в launch-параметре `tgWebAppFullscreen`.

В проекте Full Screen запрашивается на мобильных при старте (раздел 2.3).

### 3.3. Viewport: height vs stableHeight

| Сигнал | CSS-переменная | Когда меняется |
|---|---|---|
| `viewport.height()` | `--tg-viewport-height` | в реальном времени: при перетаскивании BottomSheet, показе клавиатуры |
| `viewport.stableHeight()` | `--tg-viewport-stable-height` | только в «стабильном» состоянии (без drag/анимации клавиатуры) |
| `viewport.isExpanded()` | — | приложение на максимальной высоте |

Правило:
- **фиксированные нижние элементы** (панель ввода, кнопки действий) привязывайте к `stableHeight` —
  иначе на iOS их будет «дёргать» при появлении клавиатуры;
- для скролл-контейнеров, где нужна перерисовка в реальном времени, используйте `height`;
- `viewport.expand()` зовите при инициализации, чтобы стартовать на полной высоте.

Для верстки на весь экран используйте `height: 100dvh` (динамическая высота вьюпорта) — в проекте так
сделаны полноэкранные экраны (общий каркас [webapp/src/shared/components/FullHeightPage/FullHeightPage.module.css](../webapp/src/shared/components/FullHeightPage/FullHeightPage.module.css)).

### 3.4. Safe area insets — два разных вида

- **`safeAreaInset`** — аппаратные отступы устройства (чёлка, скругления, home-indicator). Заметны
  на iPhone X+. Стороны: `top/bottom/left/right`.
- **`contentSafeAreaInset`** — отступы под **интерфейс самого Telegram** (плавающая шапка в Full Screen,
  нижняя панель). Не нули в основном в Full Screen на мобильных.

SDK биндит обе группы на `:root` с префиксом `--tg-viewport-` через `viewport.bindCssVars()`
(помимо них Telegram-клиент может класть нативные `--tg-safe-area-inset-*`). В этом проекте используются
именно SDK-переменные:

```
--tg-viewport-safe-area-inset-top | -bottom | -left | -right
--tg-viewport-content-safe-area-inset-top | -bottom | -left | -right
```

**Рекомендуемый паттерн в CSS** (цепочка фоллбэков: SDK-переменная → нативный `env()` для вне-Telegram →
`0px` для десктопа). Из проекта ([webapp/src/shared/components/AppPage/AppPage.module.css](../webapp/src/shared/components/AppPage/AppPage.module.css),
[webapp/src/shared/components/FullHeightPage/FullHeightPage.module.css](../webapp/src/shared/components/FullHeightPage/FullHeightPage.module.css)):

```css
padding-top: calc(
  16px +
  var(--tg-viewport-safe-area-inset-top, env(safe-area-inset-top, 0px)) +
  var(--tg-viewport-content-safe-area-inset-top, 0px)
);
/* снизу обычно достаточно нативного env() */
padding-bottom: calc(16px + env(safe-area-inset-bottom, 0px));
```

Учитывать нужно **оба** вида insets, иначе в Full Screen контент уедет под чёлку или под шапку Telegram.

### 3.5. Свайпы и подтверждение закрытия

- **Вертикальные свайпы по телу** (Bot API 7.7+): по умолчанию свайп вниз сворачивает приложение.
  `disableVerticalSwipes()` отключает это для тела (нужно, когда у вас свои свайпы — карусели, скролл
  чата), `enableVerticalSwipes()` возвращает. Свайп по **шапке** не отключается никогда.
- **Подтверждение закрытия** (Bot API 6.2+): `enableClosingConfirmation()` показывает системный диалог
  при попытке закрыть — полезно в многошаговых формах, чтобы не потерять данные;
  `disableClosingConfirmation()` выключает.

> В `@telegram-apps/sdk-react` v3 это отдельные монтируемые компоненты (`swipeBehavior`,
> `closingBehavior`) со своими `isAvailable()`-гардами — это **не** методы legacy-глобала
> `window.Telegram.WebApp`. Точные имена методов сверяйте по типам SDK (`dist/dts/index.d.ts`),
> т. к. публичные доки v3 местами недоступны.

---

## 4. Чек-лист и прочие практики

- **Порядок инициализации — до `render()`.** В [webapp/src/init.ts](../webapp/src/init.ts):
  `init()` → `initData.restore()` → `themeParams.mountSync()` → `miniApp.mountSync()` →
  `viewport.mount()`+`bindCssVars()` (insets для `--tg-viewport-*`).
- **Каждый шаг SDK — под `isAvailable()`-гардом.** Вне Telegram (dev-браузер) часть компонентов
  недоступна; защита не даёт приложению упасть.
- **Платформу читаем один раз** на уровне модуля (она не меняется), а не в `useEffect`.
- **Тему берём из `useTheme()`** (`shared/theme`) — дефолт из сигнала `themeParams.isDark` (реагирует на
  смену темы Telegram без перезагрузки), с учётом ручного выбора пользователя (раздел 1).
- **`100dvh`, не `100vh`** для полноэкранных раскладок (высота вьюпорта динамическая).
- **`stableHeight` для нижних панелей**, `height` для скролла (раздел 3.3).

---

## Источники

Официальные и первоисточники (сверяйтесь при обновлении версий):

- Telegram Mini Apps (официально) — <https://core.telegram.org/bots/webapps>
- Mini Apps 2.0: Full-Screen Mode — <https://telegram.org/blog/fullscreen-miniapps-and-more>
- Документация комьюнити (platform/viewport/methods) — <https://docs.telegram-mini-apps.com/>
- npm `@telegram-apps/sdk-react` — <https://www.npmjs.com/package/@telegram-apps/sdk-react>
