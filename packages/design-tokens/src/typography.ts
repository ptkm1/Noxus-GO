export const typography = {
  display: { fontSize: 28, lineHeight: 34, fontWeight: "700" as const },
  title: { fontSize: 22, lineHeight: 28, fontWeight: "700" as const },
  titleSm: { fontSize: 18, lineHeight: 24, fontWeight: "600" as const },
  body: { fontSize: 16, lineHeight: 22, fontWeight: "400" as const },
  bodySm: { fontSize: 14, lineHeight: 20, fontWeight: "400" as const },
  caption: { fontSize: 12, lineHeight: 16, fontWeight: "400" as const },
  label: { fontSize: 14, lineHeight: 18, fontWeight: "500" as const },
} as const;

export const fontFamily = {
  sans: "'Sora', system-ui, -apple-system, sans-serif",
  mono: "ui-monospace, monospace",
} as const;
