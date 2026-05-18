import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  // Monorepo: VITE_* no .env da raiz do repo (Pedidos/.env)
  envDir: path.resolve(__dirname, "../.."),
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
