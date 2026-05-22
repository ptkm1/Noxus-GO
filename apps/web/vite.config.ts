import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const srcDir = path.resolve(__dirname, "src");

export default defineConfig({
  resolve: {
    alias: {
      "@": srcDir,
    },
    dedupe: ["react", "react-dom"],
  },
  // Monorepo: VITE_* e EXPO_PUBLIC_* no .env da raiz (Pedidos/.env)
  envDir: path.resolve(__dirname, "../.."),
  envPrefix: ["VITE_", "EXPO_PUBLIC_"],
  plugins: [react()],
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
