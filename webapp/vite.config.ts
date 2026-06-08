import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    // разрешаем внешние хосты — пригодится при прокидывании Mini App через туннель (ngrok/cloudflared)
    allowedHosts: true,
  },
  build: {
    outDir: "dist",
    target: "es2022",
  },
});
