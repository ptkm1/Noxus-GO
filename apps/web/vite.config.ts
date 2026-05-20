import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  // Monorepo: VITE_* e EXPO_PUBLIC_* no .env da raiz (Pedidos/.env)
  envDir: path.resolve(__dirname, "../.."),
  envPrefix: ["VITE_", "EXPO_PUBLIC_"],
  plugins: [react()],
  resolve: {
    // Monorepo: @tanstack/react-query pode trazer react aninhado; duas cópias = Invalid hook call.
    dedupe: ["react", "react-dom"],
  },
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:4000",
        changeOrigin: true,
      },
    },
  },
});
