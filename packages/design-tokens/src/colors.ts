/** Tokens PedixPro — oklch (web CSS) + hex (React Native). */

export type SemanticColors = {
  background: string;
  foreground: string;
  card: string;
  cardForeground: string;
  popover: string;
  popoverForeground: string;
  primary: string;
  primaryForeground: string;
  secondary: string;
  secondaryForeground: string;
  muted: string;
  mutedForeground: string;
  accent: string;
  accentForeground: string;
  destructive: string;
  destructiveForeground: string;
  success: string;
  successForeground: string;
  warning: string;
  warningForeground: string;
  info: string;
  infoForeground: string;
  border: string;
  input: string;
  ring: string;
  chart1: string;
  chart2: string;
  chart3: string;
  chart4: string;
  chart5: string;
  sidebar: string;
  sidebarForeground: string;
  sidebarPrimary: string;
  sidebarPrimaryForeground: string;
  sidebarAccent: string;
  sidebarAccentForeground: string;
  sidebarBorder: string;
  sidebarRing: string;
};

/** PedixPro dark (navy + teal). */
export const darkColorsOklch: Record<keyof SemanticColors, string> = {
  background: "#111827",
  foreground: "#f8fafc",
  card: "#1f2937",
  cardForeground: "#f8fafc",
  popover: "#1f2937",
  popoverForeground: "#f8fafc",
  primary: "#2a7a8c",
  primaryForeground: "#f8fafc",
  secondary: "#1f2937",
  secondaryForeground: "#f8fafc",
  muted: "#1f2937",
  mutedForeground: "#94a3b8",
  accent: "#1f2937",
  accentForeground: "#f8fafc",
  destructive: "oklch(0.60 0.22 25)",
  destructiveForeground: "#f8fafc",
  success: "oklch(0.72 0.19 160)",
  successForeground: "#111827",
  warning: "oklch(0.80 0.16 85)",
  warningForeground: "#111827",
  info: "oklch(0.65 0.18 250)",
  infoForeground: "#f8fafc",
  border: "#334155",
  input: "#334155",
  ring: "#2a7a8c",
  chart1: "#2a7a8c",
  chart2: "#5eead4",
  chart3: "#94a3b8",
  chart4: "#14b8a6",
  chart5: "#fbbf24",
  sidebar: "#0b1220",
  sidebarForeground: "#f8fafc",
  sidebarPrimary: "#2a7a8c",
  sidebarPrimaryForeground: "#f8fafc",
  sidebarAccent: "#1f2937",
  sidebarAccentForeground: "#f8fafc",
  sidebarBorder: "#334155",
  sidebarRing: "#2a7a8c",
};

/** Hex equivalentes para React Native. */
export const darkColorsHex: SemanticColors = {
  background: "#111827",
  foreground: "#f8fafc",
  card: "#1f2937",
  cardForeground: "#f8fafc",
  popover: "#1f2937",
  popoverForeground: "#f8fafc",
  primary: "#2A7A8C",
  primaryForeground: "#f8fafc",
  secondary: "#1f2937",
  secondaryForeground: "#f8fafc",
  muted: "#1f2937",
  mutedForeground: "#94a3b8",
  accent: "#1f2937",
  accentForeground: "#f8fafc",
  destructive: "#e85d5d",
  destructiveForeground: "#f8fafc",
  success: "#5ee9a8",
  successForeground: "#111827",
  warning: "#e8c547",
  warningForeground: "#111827",
  info: "#6b9ee8",
  infoForeground: "#f8fafc",
  border: "#334155",
  input: "#334155",
  ring: "#2A7A8C",
  chart1: "#2A7A8C",
  chart2: "#5eead4",
  chart3: "#94a3b8",
  chart4: "#14b8a6",
  chart5: "#fbbf24",
  sidebar: "#0b1220",
  sidebarForeground: "#f8fafc",
  sidebarPrimary: "#2A7A8C",
  sidebarPrimaryForeground: "#f8fafc",
  sidebarAccent: "#1f2937",
  sidebarAccentForeground: "#f8fafc",
  sidebarBorder: "#334155",
  sidebarRing: "#2A7A8C",
};

/** Light — superfícies claras + primary teal da marca. */
export const lightColorsHex: SemanticColors = {
  background: "#F8FAFC",
  foreground: "#111827",
  card: "#ffffff",
  cardForeground: "#111827",
  popover: "#ffffff",
  popoverForeground: "#111827",
  primary: "#0F4C5C",
  primaryForeground: "#F8FAFC",
  secondary: "#E2E8F0",
  secondaryForeground: "#111827",
  muted: "#E2E8F0",
  mutedForeground: "#64748b",
  accent: "#E2E8F0",
  accentForeground: "#111827",
  destructive: "#dc2626",
  destructiveForeground: "#ffffff",
  success: "#10b981",
  successForeground: "#ffffff",
  warning: "#d97706",
  warningForeground: "#111827",
  info: "#3b82f6",
  infoForeground: "#ffffff",
  border: "#E2E8F0",
  input: "#E2E8F0",
  ring: "#0F4C5C",
  chart1: "#0F4C5C",
  chart2: "#1e6b7a",
  chart3: "#64748b",
  chart4: "#0d9488",
  chart5: "#f59e0b",
  sidebar: "#ffffff",
  sidebarForeground: "#111827",
  sidebarPrimary: "#0F4C5C",
  sidebarPrimaryForeground: "#F8FAFC",
  sidebarAccent: "#f1f5f9",
  sidebarAccentForeground: "#111827",
  sidebarBorder: "#E2E8F0",
  sidebarRing: "#0F4C5C",
};

export const lightColorsOklch: Record<keyof SemanticColors, string> = {
  background: "#f8fafc",
  foreground: "#111827",
  card: "#ffffff",
  cardForeground: "#111827",
  popover: "#ffffff",
  popoverForeground: "#111827",
  primary: "#0f4c5c",
  primaryForeground: "#f8fafc",
  secondary: "#e2e8f0",
  secondaryForeground: "#111827",
  muted: "#e2e8f0",
  mutedForeground: "#64748b",
  accent: "#e2e8f0",
  accentForeground: "#111827",
  destructive: "oklch(0.55 0.22 25)",
  destructiveForeground: "#ffffff",
  success: "oklch(0.62 0.17 160)",
  successForeground: "#ffffff",
  warning: "oklch(0.65 0.16 85)",
  warningForeground: "#111827",
  info: "oklch(0.55 0.18 250)",
  infoForeground: "#ffffff",
  border: "#e2e8f0",
  input: "#e2e8f0",
  ring: "#0f4c5c",
  chart1: "#0f4c5c",
  chart2: "#1e6b7a",
  chart3: "#64748b",
  chart4: "#0d9488",
  chart5: "#f59e0b",
  sidebar: "#ffffff",
  sidebarForeground: "#111827",
  sidebarPrimary: "#0f4c5c",
  sidebarPrimaryForeground: "#f8fafc",
  sidebarAccent: "#f1f5f9",
  sidebarAccentForeground: "#111827",
  sidebarBorder: "#e2e8f0",
  sidebarRing: "#0f4c5c",
};
