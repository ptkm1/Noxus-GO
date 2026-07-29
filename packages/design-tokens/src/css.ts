import { darkColorsOklch } from "./colors.js";

const cssVarMap: Record<string, string> = {
  background: darkColorsOklch.background,
  foreground: darkColorsOklch.foreground,
  card: darkColorsOklch.card,
  "card-foreground": darkColorsOklch.cardForeground,
  popover: darkColorsOklch.popover,
  "popover-foreground": darkColorsOklch.popoverForeground,
  primary: darkColorsOklch.primary,
  "primary-foreground": darkColorsOklch.primaryForeground,
  secondary: darkColorsOklch.secondary,
  "secondary-foreground": darkColorsOklch.secondaryForeground,
  muted: darkColorsOklch.muted,
  "muted-foreground": darkColorsOklch.mutedForeground,
  accent: darkColorsOklch.accent,
  "accent-foreground": darkColorsOklch.accentForeground,
  destructive: darkColorsOklch.destructive,
  "destructive-foreground": darkColorsOklch.destructiveForeground,
  success: darkColorsOklch.success,
  "success-foreground": darkColorsOklch.successForeground,
  warning: darkColorsOklch.warning,
  "warning-foreground": darkColorsOklch.warningForeground,
  info: darkColorsOklch.info,
  "info-foreground": darkColorsOklch.infoForeground,
  border: darkColorsOklch.border,
  input: darkColorsOklch.input,
  ring: darkColorsOklch.ring,
  "chart-1": darkColorsOklch.chart1,
  "chart-2": darkColorsOklch.chart2,
  "chart-3": darkColorsOklch.chart3,
  "chart-4": darkColorsOklch.chart4,
  "chart-5": darkColorsOklch.chart5,
  sidebar: darkColorsOklch.sidebar,
  "sidebar-foreground": darkColorsOklch.sidebarForeground,
  "sidebar-primary": darkColorsOklch.sidebarPrimary,
  "sidebar-primary-foreground": darkColorsOklch.sidebarPrimaryForeground,
  "sidebar-accent": darkColorsOklch.sidebarAccent,
  "sidebar-accent-foreground": darkColorsOklch.sidebarAccentForeground,
  "sidebar-border": darkColorsOklch.sidebarBorder,
  "sidebar-ring": darkColorsOklch.sidebarRing,
};

/** Bloco :root para injetar em index.css (PedixPro dark). */
export function cssRootBlock(selector = ":root"): string {
  const lines = Object.entries(cssVarMap).map(([k, v]) => `  --${k}: ${v};`);
  return `${selector} {\n${lines.join("\n")}\n  --radius: 0.625rem;\n}`;
}
