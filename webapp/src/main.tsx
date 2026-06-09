import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@telegram-apps/telegram-ui/dist/styles.css";
import "./index.css";
import { App } from "./app/App";
import { initTelegram } from "./init";

// Инициализируем Telegram SDK до рендера, чтобы тема/viewport были готовы
initTelegram();

const root = document.getElementById("root");
if (!root) throw new Error("Root element #root not found");

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
