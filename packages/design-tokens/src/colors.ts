/** Tokens VendaForce — oklch (web CSS) + hex (React Native). */

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

/** VendaForce dark (referência :root). */
export const darkColorsOklch: Record<keyof SemanticColors, string> = {
  background: "oklch(0.13 0.01 260)",
  foreground: "oklch(0.98 0 0)",
  card: "oklch(0.17 0.01 260)",
  cardForeground: "oklch(0.98 0 0)",
  popover: "oklch(0.15 0.01 260)",
  popoverForeground: "oklch(0.98 0 0)",
  primary: "oklch(0.72 0.19 160)",
  primaryForeground: "oklch(0.13 0.01 260)",
  secondary: "oklch(0.22 0.01 260)",
  secondaryForeground: "oklch(0.85 0 0)",
  muted: "oklch(0.20 0.01 260)",
  mutedForeground: "oklch(0.60 0 0)",
  accent: "oklch(0.25 0.02 260)",
  accentForeground: "oklch(0.98 0 0)",
  destructive: "oklch(0.60 0.22 25)",
  destructiveForeground: "oklch(0.98 0 0)",
  success: "oklch(0.72 0.19 160)",
  successForeground: "oklch(0.13 0.01 260)",
  warning: "oklch(0.80 0.16 85)",
  warningForeground: "oklch(0.13 0.01 260)",
  info: "oklch(0.65 0.18 250)",
  infoForeground: "oklch(0.98 0 0)",
  border: "oklch(0.28 0.01 260)",
  input: "oklch(0.20 0.01 260)",
  ring: "oklch(0.72 0.19 160)",
  chart1: "oklch(0.72 0.19 160)",
  chart2: "oklch(0.65 0.18 250)",
  chart3: "oklch(0.80 0.16 85)",
  chart4: "oklch(0.70 0.20 320)",
  chart5: "oklch(0.75 0.18 40)",
  sidebar: "oklch(0.11 0.01 260)",
  sidebarForeground: "oklch(0.98 0 0)",
  sidebarPrimary: "oklch(0.72 0.19 160)",
  sidebarPrimaryForeground: "oklch(0.13 0.01 260)",
  sidebarAccent: "oklch(0.20 0.01 260)",
  sidebarAccentForeground: "oklch(0.98 0 0)",
  sidebarBorder: "oklch(0.22 0.01 260)",
  sidebarRing: "oklch(0.72 0.19 160)",
};

/** Hex equivalentes (aproximação oklch → sRGB para React Native). */
export const darkColorsHex: SemanticColors = {
  background: "#1a1b26",
  foreground: "#fafafa",
  card: "#22232f",
  cardForeground: "#fafafa",
  popover: "#1e1f2a",
  popoverForeground: "#fafafa",
  primary: "#5ee9a8",
  primaryForeground: "#1a1b26",
  secondary: "#2a2b38",
  secondaryForeground: "#d4d4d8",
  muted: "#262733",
  mutedForeground: "#9ca3af",
  accent: "#2f3040",
  accentForeground: "#fafafa",
  destructive: "#e85d5d",
  destructiveForeground: "#fafafa",
  success: "#5ee9a8",
  successForeground: "#1a1b26",
  warning: "#e8c547",
  warningForeground: "#1a1b26",
  info: "#6b9ee8",
  infoForeground: "#fafafa",
  border: "#3a3b4a",
  input: "#262733",
  ring: "#5ee9a8",
  chart1: "#5ee9a8",
  chart2: "#6b9ee8",
  chart3: "#e8c547",
  chart4: "#d97fd9",
  chart5: "#e8a85c",
  sidebar: "#14151f",
  sidebarForeground: "#fafafa",
  sidebarPrimary: "#5ee9a8",
  sidebarPrimaryForeground: "#1a1b26",
  sidebarAccent: "#262733",
  sidebarAccentForeground: "#fafafa",
  sidebarBorder: "#2a2b38",
  sidebarRing: "#5ee9a8",
};

/** Light — mesma semântica, superfícies claras + primary esmeralda. */
export const lightColorsHex: SemanticColors = {
  background: "#f8f9fc",
  foreground: "#1a1b26",
  card: "#ffffff",
  cardForeground: "#1a1b26",
  popover: "#ffffff",
  popoverForeground: "#1a1b26",
  primary: "#10b981",
  primaryForeground: "#ffffff",
  secondary: "#f1f2f6",
  secondaryForeground: "#3f4256",
  muted: "#eef0f5",
  mutedForeground: "#64748b",
  accent: "#e8ecf4",
  accentForeground: "#1a1b26",
  destructive: "#dc2626",
  destructiveForeground: "#ffffff",
  success: "#10b981",
  successForeground: "#ffffff",
  warning: "#d97706",
  warningForeground: "#1a1b26",
  info: "#3b82f6",
  infoForeground: "#ffffff",
  border: "#e2e5ef",
  input: "#e2e5ef",
  ring: "#10b981",
  chart1: "#10b981",
  chart2: "#3b82f6",
  chart3: "#d97706",
  chart4: "#a855f7",
  chart5: "#f59e0b",
  sidebar: "#ffffff",
  sidebarForeground: "#1a1b26",
  sidebarPrimary: "#10b981",
  sidebarPrimaryForeground: "#ffffff",
  sidebarAccent: "#f1f2f6",
  sidebarAccentForeground: "#1a1b26",
  sidebarBorder: "#e2e5ef",
  sidebarRing: "#10b981",
};

export const lightColorsOklch: Record<keyof SemanticColors, string> = {
  background: "oklch(0.98 0.01 260)",
  foreground: "oklch(0.13 0.01 260)",
  card: "oklch(1 0 0)",
  cardForeground: "oklch(0.13 0.01 260)",
  popover: "oklch(1 0 0)",
  popoverForeground: "oklch(0.13 0.01 260)",
  primary: "oklch(0.62 0.17 160)",
  primaryForeground: "oklch(1 0 0)",
  secondary: "oklch(0.95 0.01 260)",
  secondaryForeground: "oklch(0.35 0.02 260)",
  muted: "oklch(0.94 0.01 260)",
  mutedForeground: "oklch(0.50 0.02 260)",
  accent: "oklch(0.93 0.02 260)",
  accentForeground: "oklch(0.13 0.01 260)",
  destructive: "oklch(0.55 0.22 25)",
  destructiveForeground: "oklch(1 0 0)",
  success: "oklch(0.62 0.17 160)",
  successForeground: "oklch(1 0 0)",
  warning: "oklch(0.65 0.16 85)",
  warningForeground: "oklch(0.13 0.01 260)",
  info: "oklch(0.55 0.18 250)",
  infoForeground: "oklch(1 0 0)",
  border: "oklch(0.90 0.01 260)",
  input: "oklch(0.90 0.01 260)",
  ring: "oklch(0.62 0.17 160)",
  chart1: "oklch(0.62 0.17 160)",
  chart2: "oklch(0.55 0.18 250)",
  chart3: "oklch(0.65 0.16 85)",
  chart4: "oklch(0.55 0.20 320)",
  chart5: "oklch(0.70 0.18 40)",
  sidebar: "oklch(1 0 0)",
  sidebarForeground: "oklch(0.13 0.01 260)",
  sidebarPrimary: "oklch(0.62 0.17 160)",
  sidebarPrimaryForeground: "oklch(1 0 0)",
  sidebarAccent: "oklch(0.95 0.01 260)",
  sidebarAccentForeground: "oklch(0.13 0.01 260)",
  sidebarBorder: "oklch(0.90 0.01 260)",
  sidebarRing: "oklch(0.62 0.17 160)",
};
