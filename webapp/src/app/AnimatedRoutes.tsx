import { AnimatePresence } from "framer-motion";
import { lazy, Suspense } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { HomePage } from "../pages/home/HomePage";
import { ROUTES } from "./routes";

// HomePage грузится вместе с основным бандлом — это первый экран, blank flash недопустим.
// Остальные страницы — ленивые чанки; startTransition в useTransitionNavigate
// удерживает текущий UI до готовности чанка, поэтому Suspense fallback=null не мелькает.
const CharactersListPage = lazy(() =>
  import("../pages/characters/CharactersListPage").then((m) => ({
    default: m.CharactersListPage,
  }))
);
const CharacterEditPage = lazy(() =>
  import("../pages/characters/CharacterEditPage").then((m) => ({
    default: m.CharacterEditPage,
  }))
);
const PresetsListPage = lazy(() =>
  import("../pages/generation-presets/PresetsListPage").then((m) => ({
    default: m.PresetsListPage,
  }))
);
const PresetEditPage = lazy(() =>
  import("../pages/generation-presets/PresetEditPage").then((m) => ({
    default: m.PresetEditPage,
  }))
);
const PersonasListPage = lazy(() =>
  import("../pages/personas/PersonasListPage").then((m) => ({
    default: m.PersonasListPage,
  }))
);
const PersonaEditPage = lazy(() =>
  import("../pages/personas/PersonaEditPage").then((m) => ({
    default: m.PersonaEditPage,
  }))
);
const RpChatsPage = lazy(() =>
  import("../pages/rp-chat/RpChatsPage").then((m) => ({ default: m.RpChatsPage }))
);
const RpChatNewPage = lazy(() =>
  import("../pages/rp-chat/RpChatNewPage").then((m) => ({ default: m.RpChatNewPage }))
);
const RpChatsAllPage = lazy(() =>
  import("../pages/rp-chat/RpChatsAllPage").then((m) => ({ default: m.RpChatsAllPage }))
);
const RpChatPage = lazy(() =>
  import("../pages/rp-chat/RpChatPage").then((m) => ({ default: m.RpChatPage }))
);
const RpChatSettingsPage = lazy(() =>
  import("../pages/rp-chat/RpChatSettingsPage").then((m) => ({ default: m.RpChatSettingsPage }))
);
const RpChatGraphPage = lazy(() =>
  import("../pages/rp-chat/RpChatGraphPage").then((m) => ({ default: m.RpChatGraphPage }))
);
const StoriesPage = lazy(() =>
  import("../pages/narrator/StoriesPage").then((m) => ({ default: m.StoriesPage }))
);
const StoryNewPage = lazy(() =>
  import("../pages/narrator/StoryNewPage").then((m) => ({ default: m.StoryNewPage }))
);
const StoryPage = lazy(() =>
  import("../pages/narrator/StoryPage").then((m) => ({ default: m.StoryPage }))
);
const BooksListPage = lazy(() =>
  import("../pages/knowledge-books/BooksListPage").then((m) => ({ default: m.BooksListPage }))
);
const BookEditPage = lazy(() =>
  import("../pages/knowledge-books/BookEditPage").then((m) => ({ default: m.BookEditPage }))
);
const TemplatesListPage = lazy(() =>
  import("../pages/narrator-templates/TemplatesListPage").then((m) => ({ default: m.TemplatesListPage }))
);
const TemplateEditPage = lazy(() =>
  import("../pages/narrator-templates/TemplateEditPage").then((m) => ({ default: m.TemplateEditPage }))
);

/**
 * Маршруты приложения с анимированными переходами.
 * Вынесены из App в отдельный компонент: useLocation() требует нахождения внутри Router,
 * а App рендерит HashRouter сам — поэтому хук нельзя вызвать прямо в App.
 * Suspense fallback=null: startTransition в useTransitionNavigate удерживает старую страницу,
 * пока чанк не загружен, поэтому пустой fallback не нужен.
 */
export function AnimatedRoutes() {
  const location = useLocation();
  return (
    <Suspense fallback={null}>
      <AnimatePresence mode="wait">
        <Routes location={location} key={location.pathname}>
          <Route path={ROUTES.home} element={<HomePage />} />
          {/* Хаб чатов. Статические /chats/new и /chats/all стоят раньше /chats/:id. */}
          <Route path={ROUTES.chats} element={<RpChatsPage />} />
          <Route path={ROUTES.chatNew} element={<RpChatNewPage />} />
          <Route path={ROUTES.chatAll} element={<RpChatsAllPage />} />
          {/* Статические /chats/:id/settings и /chats/:id/graph стоят раньше /chats/:id */}
          <Route path={ROUTES.chatSettings} element={<RpChatSettingsPage />} />
          <Route path={ROUTES.chatGraph} element={<RpChatGraphPage />} />
          <Route path={ROUTES.chatView} element={<RpChatPage />} />
          <Route path={ROUTES.characters} element={<CharactersListPage />} />
          {/* Статический /characters/new стоит раньше /characters/:id — react-router отдаёт ему приоритет. */}
          <Route path={ROUTES.characterNew} element={<CharacterEditPage />} />
          <Route path={ROUTES.characterEdit} element={<CharacterEditPage />} />
          <Route path={ROUTES.presets} element={<PresetsListPage />} />
          {/* Статический /presets/new стоит раньше /presets/:id — react-router отдаёт ему приоритет. */}
          <Route path={ROUTES.presetNew} element={<PresetEditPage />} />
          <Route path={ROUTES.presetEdit} element={<PresetEditPage />} />
          <Route path={ROUTES.personas} element={<PersonasListPage />} />
          {/* Статический /personas/new стоит раньше /personas/:id — react-router отдаёт ему приоритет. */}
          <Route path={ROUTES.personaNew} element={<PersonaEditPage />} />
          <Route path={ROUTES.personaEdit} element={<PersonaEditPage />} />

          {/* Narrator-режим. Статические /new стоят раньше /:id. */}
          <Route path={ROUTES.stories} element={<StoriesPage />} />
          <Route path={ROUTES.storyNew} element={<StoryNewPage />} />
          <Route path={ROUTES.storyView} element={<StoryPage />} />
          <Route path={ROUTES.books} element={<BooksListPage />} />
          <Route path={ROUTES.bookNew} element={<BookEditPage />} />
          <Route path={ROUTES.bookEdit} element={<BookEditPage />} />
          <Route path={ROUTES.narratorTemplates} element={<TemplatesListPage />} />
          <Route path={ROUTES.narratorTemplateNew} element={<TemplateEditPage />} />
          <Route path={ROUTES.narratorTemplateEdit} element={<TemplateEditPage />} />
          {/*
            Любой неизвестный путь → главная. Важно для Telegram Web: launch-параметры
            прилетают в hash (#tgWebAppData=…); init() их уже считал, а роутеру этот hash
            маршрутом не является — редирект уводит на главную вместо пустого экрана.
          */}
          <Route path="*" element={<Navigate to={ROUTES.home} replace />} />
        </Routes>
      </AnimatePresence>
    </Suspense>
  );
}
