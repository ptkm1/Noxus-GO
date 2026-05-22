import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import { initThemeFromStorage } from "./lib/theme";
import App from "./App.tsx";

initThemeFromStorage();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
