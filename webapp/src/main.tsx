import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
// Стили Mantine — в CSS-слоях (@layer): неслоёные index.css и наши .module.css всегда сильнее их,
// переопределения обходятся без !important.
import "@mantine/core/styles.layer.css";
import "@mantine/notifications/styles.layer.css";
import "./index.css";
import { App } from "./app/App";
import { resolveDeepLink } from "./app/deepLink";
import { initTelegram } from "./init";
import { bindVisualViewportHeight } from "./shared/viewport";

// Инициализируем Telegram SDK до рендера, чтобы тема/viewport были готовы
initTelegram();

// Высота видимой части окна (без клавиатуры) — для экранов с полем ввода внизу.
bindVisualViewportHeight();

// Deep-link из web_app-кнопки бота: переписываем hash на нужный маршрут ДО старта роутера
// (после initTelegram — launch-данные из hash уже считаны), иначе catch-all уведёт на главную.
resolveDeepLink();

const root = document.getElementById("root");
if (!root) throw new Error("Root element #root not found");

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
