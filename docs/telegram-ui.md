# Telegram UI (tgui) — гайд по стилям и режимам Mini App

Документация по библиотеке стилей, на которой построен webapp этого проекта, и по
тому, как корректно вести себя в разных клиентах и режимах открытия Mini App.

**Стек, к которому относится документ:**

| Пакет | Версия в проекте | Роль |
|---|---|---|
| [`@telegram-apps/telegram-ui`](https://www.npmjs.com/package/@telegram-apps/telegram-ui) | `2.1.13` | Библиотека UI-компонентов и стилей (далее **tgui**) |
| [`@telegram-apps/sdk-react`](https://www.npmjs.com/package/@telegram-apps/sdk-react) | `3.3.9` | Доступ к Telegram WebApp (тема, viewport, платформа, safe area) |

Где это в коде:
- Корень приложения и проброс темы/платформы — [webapp/src/app/App.tsx](../webapp/src/app/App.tsx)
- Инициализация SDK — [webapp/src/init.ts](../webapp/src/init.ts)
- Определение платформы — [webapp/src/shared/telegram/platform.ts](../webapp/src/shared/telegram/platform.ts)
- Импорт стилей и порядок запуска — [webapp/src/main.tsx](../webapp/src/main.tsx)
- Фон webview и глобальные стили — [webapp/src/index.css](../webapp/src/index.css)

> ⚠️ Версии в этом файле — справочные на момент написания. Источник правды — `webapp/package.json`.
> Перед обновлением tgui/SDK сверяйтесь с официальными доками (ссылки в конце).

---

## 1. Что такое tgui и как его правильно подключать

tgui — React-библиотека компонентов, повторяющих нативный UI Telegram (списки, ячейки
`Cell`, кнопки, модалки, `Snackbar` и т. д.). Она сама подтягивает цвета темы Telegram в
свои CSS-переменные, поэтому компоненты выглядят «как родные» и в светлой, и в тёмной теме,
и по-разному на iOS / Android-оформлении.

- Репозиторий: <https://github.com/Telegram-Mini-Apps/TelegramUI>
- Песочница компонентов: <https://tgui.xelene.me/>

### 1.1. Импорт стилей — обязателен и идёт первым

CSS библиотеки должен быть импортирован **до** любых компонентов, иначе `--tgui--*`-переменные
не определены и компоненты рисуются неоформленными. В проекте это сделано в точке входа
([webapp/src/main.tsx](../webapp/src/main.tsx)):

```ts
import "@telegram-apps/telegram-ui/dist/styles.css";
import "./index.css";
```

### 1.2. `<AppRoot>` — обязательная обёртка всего приложения

`AppRoot` — контекст-провайдер tgui. Без него дочерние компоненты не получают класс платформы
и темы, а компоненты на порталах (`Modal`, `Snackbar`) «тихо» ломаются. Оборачиваем им всё
приложение **один раз** ([webapp/src/app/App.tsx](../webapp/src/app/App.tsx)).

Ключевые пропсы:

| Проп | Значения | Что делает |
|---|---|---|
| `platform` | `"ios"` \| `"base"` | Выбор оформления: `"ios"` — iOS-стиль (типографика, скругления), `"base"` — Android/прочее |
| `appearance` | `"light"` \| `"dark"` | Светлая/тёмная тема |
| `portalContainer` | `RefObject<HTMLElement>` | Куда монтировать порталы (по умолчанию — div самого AppRoot) |

### 1.3. Главный подводный камень: задавать `platform` и `appearance` ЯВНО

Если не передать пропсы, tgui пытается определить тему и платформу сам — но читает **legacy-глобал**
`window.Telegram.WebApp`, которого `@telegram-apps/sdk-react` v3 **не создаёт**. В итоге tgui
сваливается на ОС-ную `matchMedia('(prefers-color-scheme: dark)')` — то есть на тему операционной
системы, а не Telegram. Симптомы (наблюдались в этом проекте):

- неверная тема на ПК, если тема ОС не совпадает с темой Telegram (например, белый hover у кнопок
  на тёмной теме Telegram при светлой ОС);
- мигание фона при сворачивании/разворачивании окна (AppRoot терял dark-класс).

**Решение — передавать оба пропса из сигналов SDK** (как в [webapp/src/app/App.tsx](../webapp/src/app/App.tsx)):

```tsx
import { AppRoot } from "@telegram-apps/telegram-ui";
import { miniApp, useSignal } from "@telegram-apps/sdk-react";
import { getPlatform } from "../shared/telegram/platform";

// Платформа сессии не меняется — маппим один раз на уровне модуля.
// macos/ios → "ios"-оформление, всё прочее (включая dev-браузер) → "base".
const rawPlatform = getPlatform();
const platform: "ios" | "base" =
  rawPlatform === "ios" || rawPlatform === "macos" ? "ios" : "base";

export function App() {
  // Реактивный сигнал: перерисуется при смене темы Telegram, без перезагрузки.
  const isDark = useSignal(miniApp.isDark);
  return (
    <AppRoot appearance={isDark ? "dark" : "light"} platform={platform}>
      {/* ... */}
    </AppRoot>
  );
}
```

> Это та же логика маппинга, что у tgui внутри (`ios`/`macos` → `ios`, остальное → `base`),
> но на достоверном источнике — launch-параметрах SDK, а не на отсутствующем глобале.

### 1.4. CSS-переменные: два слоя

Цвета приходят двумя «слоями», важно не путать.

**Слой 1 — нативная тема Telegram (`--tg-theme-*` / `--tg-*`).** Ставит SDK вызовами
`themeParams.bindCssVars()` и `miniApp.bindCssVars()` на `:root`. Примеры:
`--tg-theme-bg-color`, `--tg-theme-text-color`, `--tg-theme-button-color`,
`--tg-theme-secondary-bg-color`, `--tg-theme-hint-color`, `--tg-theme-link-color` и т. д.
(`miniApp` дополнительно даёт `--tg-bg-color` и подобные).

**Слой 2 — дизайн-токены tgui (`--tgui--*`).** Живут в `dist/styles.css` и **только на `<AppRoot>`**.
Именно их используют компоненты tgui; внутри они ссылаются на `--tg-theme-*`. Примеры из проекта:
`--tgui--secondary_bg_color`, `--tgui--hint_color`, `--tgui--text_color`, `--tgui--destructive_text_color`,
`--tgui--secondary_fill`.

Практические следствия:
- **Свой CSS** для tgui-компонентов пишите через `--tgui--*` с фоллбэком: `var(--tgui--hint_color, #7d8b99)`
  (см. [webapp/src/shared/components/PromptField/PromptField.css](../webapp/src/shared/components/PromptField/PromptField.css)).
- **Фон самого webview** красьте через `--tg-*` (они на `:root`), а не через `--tgui--*` (их на `:root` нет).
  В проекте: `background: var(--tg-bg-color, var(--tg-theme-bg-color, #17212b))`
  ([webapp/src/index.css](../webapp/src/index.css)). Иначе непокрашенные области показывают чёрную
  подложку webview — особенно заметно в Full Screen после сворачивания.

### 1.4.1. Засада: фон поля (`bg_color`) ≠ фон карточки (`section_bg_color`)

`bg_color`, `section_bg_color`, `secondary_bg_color` — **разные** токены темы Telegram (а не оттенки
одного): `bg_color` — фон экрана и **фон поля ввода**; `section_bg_color` — фон карточек `Section`;
`secondary_bg_color` — подложка под сгруппированным списком. tgui `Input`/`Textarea` красит свой фон
`--tgui--bg_color`, а `Section` — `--tgui--section_bg_color`.

На большинстве тем `bg_color ≈ section_bg_color`, поэтому рассинхрон не виден. Но на темах, где они
различаются (некоторые мобильные тёмные), поле, лежащее **прямо внутри `Section`**, «выпрыгивает» из
карточки по фону. Идиоматично формы делают плоскими (голые поля на фоне страницы `bg_color`, как
`CharacterForm`/`PersonaForm`/`PresetForm`) — там поле и страница оба `bg_color` и сливаются.

Если форма всё же на `Section` (карточный вид) — приравниваем `bg_color` к `section_bg_color`
**в пределах секции** (паттерн `.section-blend-inputs` в [webapp/src/index.css](../webapp/src/index.css)):

```css
.section-blend-inputs { --tgui--bg_color: var(--tgui--section_bg_color); }
```

```tsx
<Section className="section-blend-inputs" header="…"> {/* поля внутри сольются с карточкой */}
```

Вешать **только на секцию** (не на страницу): standalone-поля на фоне страницы должны остаться
`bg_color`, иначе наоборот начнут выпрыгивать. Внутри формы `--tgui--bg_color` красит только поле
(ячейки/кнопки/разделители используют другие токены), поэтому побочек нет.

**Footer секции — отдельная засада.** `SectionFooter` (проп `footer`) рендерит `<footer>` **вне**
карточки, без своего фона → он показывает фон страницы (`bg_color`), отличный от карточки, и «выбивается».
Заголовок же лежит внутри карточки. Если нужен текст-пояснение «на карточке» — не используем проп
`footer`, а рендерим последним ребёнком секции `<p className="section-note">…</p>` (класс там же, в
`index.css`).

### 1.4.2. `Section` сама вставляет разделители между детьми — и это зависит от формы `children`

`Section` (см. `node_modules/@telegram-apps/telegram-ui/dist/components/Blocks/Section/Section.js`)
проходит по своим **прямым** детям через `React.Children.map` и кладёт `<Divider>` (`<hr>`) между
каждой соседней парой:

```js
children: Children.map(children, (child, index) => <>
  {child}
  {index < Children.count(children) - 1 && <Divider />}
</>)
```

Два факта про `React.Children.map/count` (проверено в `node_modules/react/cjs/react.development.js`,
`mapIntoArray`), которые здесь ловушка:

- **`false`/`null`/`undefined` всё равно занимают позицию.** `Children.count`/`Children.map` их не
  пропускают — просто рендерят пустоту на этом месте. Условный рендер `{cond && <X/>}`, когда `cond`
  ложный, — это не «нет ребёнка», а «ребёнок есть, просто пустой», и разделитель после него
  **всё равно вставится**, если это не последний элемент.
- **`<Fragment>` (в т. ч. `<>...</>`) не разворачивается.** Это `REACT_ELEMENT_TYPE`, как и обычный
  `<div>`, — для `Section` это один непрозрачный узел, что бы внутри него ни лежало. Разворачивается
  вглубь **только настоящий JS-массив** (несколько JSX-соседей `Section` компилируются именно в него).

**Практическое следствие — два разных паттерна дают разное число разделителей:**

```tsx
// Паттерн A: несколько соседних top-level выражений → компилируется в МАССИВ →
// Section видит несколько «слотов», разделитель ставится по позиции, даже если слот пуст.
<Section header="…">
  <Cell>…</Cell>
  {!available && <p>причина недоступности</p>}   {/* слот 2: даже когда false — «слот» есть */}
  {available && (<>…остальной контент…</>)}       {/* слот 3 */}
</Section>
// → Cell, Divider, (пусто), Divider, контент — т.е. фактически ДВА <hr> подряд сразу после Cell,
//   когда слот 2 пуст (визуально сливаются в одну линию, но по DOM их два).

// Паттерн B: всё содержимое — ОДИН тернарник/фрагмент → Section видит один непрозрачный узел →
// Children.count === 1 → разделитель не вставляется НИКОГДА, и всё вложенное (Cell, дочерние
// компоненты) для Section невидимо.
<Section header="…">
  {loading ? (<Spinner/>) : (<>
    <Cell>…</Cell>
    {enabled && (<>…</>)}
  </>)}
</Section>
```

В проекте на это напоролась `CompactSettingsSection` (`webapp/src/features/narrator/components/CompactSettingsSection.tsx`):
была собрана по паттерну A — несколько соседних условных `{}` прямо в `Section` — и получала паразитный
`Divider` сразу после главного тумблера. Исправлено оборачиванием всего тела секции в один `<>...</>`
(паттерн B), как уже было в секциях «Перевод» (`RpChatSettingsPage.tsx`, `StorySettingsPage.tsx`). Это
не осознанный дизайн, а побочный эффект структуры JSX — при правках подобных секций сверяться, какой
паттерн уже есть в файле, и не смешивать A и B внутри одной секции.

**Проп на выключение разделителей отсутствует** — `SectionProps` даёт только `header`/`footer` +
стандартные HTML-атрибуты, вставка `<Divider>` зашита в реализацию `Section` жёстко. Единственный
рычаг — форма `children`: оборачивать то, что должно считаться одним «слотом», в общий элемент (`<div>`,
`<Fragment>` — она непрозрачна) или в один тернарник, как в паттерне B.

Ровно поэтому `HintedInput` (`webapp/src/shared/components/HintedInput/HintedInput.tsx`) оборачивает `Input` и его
подсказку (`FieldHint`) в свой `<div>` — иначе между полем и его же подсказкой пролезла бы линия. По той
же причине `SectionWithFooter` (`webapp/src/shared/components/SectionWithFooter.tsx`) кладёт заметку
последним top-level ребёнком секции (получает разделитель сверху — это ожидаемо, отделяет её от
последнего поля формы).

### 1.4.3. `Button` не несёт своего гуттера — в отличие от `Cell`/`Input`/`Textarea`

`Cell`, `Input`, `Textarea` сами кладут внутренний `padding` под 22px-гуттер карточки — поставленные
прямо в `Section`, они сами выравниваются по её краям. `Button` — нет: в исходнике
(`node_modules/@telegram-apps/telegram-ui/dist/components/Blocks/Button/Button.js`) это `Tappable`
с `display: inline-flex`, без единого `padding`/`margin` по горизонтали; `stretched` лишь растягивает
его на 100% ширины **родителя**. Родитель у `Button` внутри `Section` — сама карточка без отступов
(раздел 1.4 показывает: `.tgui-4b78bed6e925088e{background:...;border-radius:12px}` — фона и радиуса
достаточно для полей, которые несут padding сами, но не для голых блоков вроде кнопок).

Следствие: `Button`, положенная в `Section` без обёртки, прижимается к боковым краям карточки, а если
она ещё и последний ребёнок — прижимается и к нижнему краю (см. скриншот-баг в `BookForm`: кнопка
«Удалить книгу» упиралась в самый низ карточки без единого пикселя отступа).

**Решение — `SectionActions`** (`webapp/src/shared/components/SectionActions/SectionActions.tsx`): обёртка для блока
кнопок в подвале секции, задаёт тот же 22px-гуттер по бокам + отступ сверху/снизу:

```tsx
<Section header="…">
  {/* поля Cell/Input/Textarea — сами выровнены */}
  <SectionActions>
    <Button size="l" stretched onClick={handleSave}>Сохранить</Button>
    {onDelete && <Button size="l" mode="outline" stretched onClick={onDelete}>Удалить</Button>}
  </SectionActions>
</Section>
```

Используется в `BookForm`, `EntryEditor`, `TemplateForm`. **Не подходит** для форм, которые не лежат
в `Section` (карточки нет) — `CharacterForm`/`PersonaForm`/`PresetForm` (раздел 1.4.1) рендерят кнопки
плоско на фоне страницы через свои локальные CSS-классы (`char-form__actions` и т. п.): без карточки нет
края, о который кнопка могла бы «обрезаться», так что тот же паддинг там не баг, а просто другой контекст
— компонент их не заменяет.

### 1.4.4. Ripple-оверлей `Tappable`/`Cell` перекрывает клики по вложенным интерактивным элементам

`Cell` внутри — это `Tappable` (`node_modules/@telegram-apps/telegram-ui/dist/components/Service/Tappable/Tappable.js`):
контейнер с `position: relative` и (на платформе `"base"`, дефолтный `interactiveAnimation="background"`)
ripple-волной поверх содержимого — `<span aria-hidden>` с CSS `position: absolute; inset: 0`, **без**
`pointer-events: none`. Ripple рендерится раньше слотов `before`/детей/`after` в JSX, но так как он
`position: absolute`, а слоты — обычный поток (`position: static`), по правилам CSS stacking он всё равно
красится **поверх** них (позиционированные элементы без `z-index` рисуются после непозиционированных,
независимо от порядка в DOM) — и, что важнее, **перехватывает hit-test**: клик по нативной кнопке,
положенной в `after`/`before`, на самом деле попадает в ripple-span, а не в кнопку. Событие всплывает
к `Tappable`, и срабатывает `onClick` самого `Cell` — вложенный `onClick` (даже со `stopPropagation()`)
до кнопки не долетает, потому что кнопка вообще не была целью события.

Симптом на практике: кнопки внутри `after`/`before` слота `Cell` либо не реагируют на клик вовсе, либо
клик «проваливается» на сам `Cell` (открывает то, что вешает на него `onClick`) — воспроизводится на
десктопе/вебе (`platform === "base"`), где ripple активен; на iOS-оформлении эффекта нет (там ripple
не рендерится).

**Решение — поднять вложенный интерактив в свой позиционированный слой поверх ripple:**

```css
.my-cell-inline-controls {
  position: relative;
  z-index: 1;
}
```

Это официально нейтральный обход (не завязан на хэш CSS-класса ripple, который может смениться при
обновлении пакета). Альтернатива — проп `interactiveAnimation="opacity"` у `Cell`/`Tappable` вовсе
отключает рендер ripple (`Tappable.js`: `hasRippleEffect = platform === 'base' && interactiveAnimation
=== 'background' && !readOnly`), но заодно гасит ripple-фидбек всей ячейки, а не только конфликт с
кнопкой — обычно нежелательно, если сама ячейка тоже кликабельна и должна давать визуальный отклик.

Применено в проекте: `.debug-stepper` (`webapp/src/features/debug/components/debug.css`) и
`.kb-entry-order` (`webapp/src/pages/knowledge-books/knowledge-books.css`) — оба кладут нативные
`<button>` в `after`-слот `Cell` для инлайновых мини-контролов (степпер настройки, стрелки порядка
записи) и решают конфликт этим паттерном.

### 1.5. Порталы выходят из-под `<AppRoot>` — гочта

Компонент, отрисованный через `createPortal(..., document.body)`, **покидает поддерево AppRoot**,
где определены `--tgui--*`. tgui-компонент в таком портале нарисуется неоформленным. Варианты:
- держать `Snackbar`/модалки внутри дерева AppRoot (tgui сам делает портал в свой контейнер) —
  так сделан `ToastProvider`;
- если портал в `body` неизбежен (лайтбокс, кроп-редактор) — не использовать там tgui-компоненты
  и задавать фиксированные цвета, а не `var(--tgui--…)` (см.
  [webapp/src/shared/components/ImageCropEditor/ImageCropEditor.css](../webapp/src/shared/components/ImageCropEditor/ImageCropEditor.css)).

### 1.6. Совместимость

- tgui `2.1.13` объявляет `peerDependencies: react ^18.2.0`. Проект работает на **React 19** —
  формально вне диапазона peer-зависимости, на практике работает. При обновлении tgui сверяйтесь
  с его peer-range.
- `@telegram-apps/sdk-react` `3.x` официально поддерживает React 17/18/19.
- Vite — без известных проблем; импорт `dist/styles.css` делаем из точки входа, не из компонента.

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
сделаны полноэкранные экраны (например, [webapp/src/pages/rp-chat/rp-chat.css](../webapp/src/pages/rp-chat/rp-chat.css)).

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
`0px` для десктопа). Из проекта ([webapp/src/pages/rp-chat/rp-chat.css](../webapp/src/pages/rp-chat/rp-chat.css),
[webapp/src/shared/components/ImageLightbox/ImageLightbox.css](../webapp/src/shared/components/ImageLightbox/ImageLightbox.css)):

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
  `init()` → `initData.restore()` → `themeParams.mountSync()`+`bindCssVars()` →
  `miniApp.mountSync()`+`bindCssVars()` → `viewport.mount()`+`bindCssVars()`. Если переменные темы не
  привязаны до первого кадра, будет вспышка неправильных цветов / нулевых insets.
- **Каждый шаг SDK — под `isAvailable()`-гардом.** Вне Telegram (dev-браузер) часть компонентов
  недоступна; защита не даёт приложению упасть.
- **Платформу читаем один раз** на уровне модуля (она не меняется), а не в `useEffect`.
- **Тему берём из сигнала** `useSignal(miniApp.isDark)` — реагирует на смену темы Telegram без перезагрузки.
- **`100dvh`, не `100vh`** для полноэкранных раскладок (высота вьюпорта динамическая).
- **`stableHeight` для нижних панелей**, `height` для скролла (раздел 3.3).
- **Доступность (a11y)** tgui отдельно не документирует — интерактивные компоненты рендерятся семантичными
  тегами, но управление фокусом/проверку скринридером делайте вручную.

---

## Источники

Официальные и первоисточники (сверяйтесь при обновлении версий):

- Telegram Mini Apps (официально) — <https://core.telegram.org/bots/webapps>
- Mini Apps 2.0: Full-Screen Mode — <https://telegram.org/blog/fullscreen-miniapps-and-more>
- Документация комьюнити (platform/viewport/methods) — <https://docs.telegram-mini-apps.com/>
- TelegramUI (репозиторий) — <https://github.com/Telegram-Mini-Apps/TelegramUI>
- TelegramUI (песочница) — <https://tgui.xelene.me/>
- npm `@telegram-apps/telegram-ui` — <https://www.npmjs.com/package/@telegram-apps/telegram-ui>
- npm `@telegram-apps/sdk-react` — <https://www.npmjs.com/package/@telegram-apps/sdk-react>
