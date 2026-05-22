export const radiusBase = "0.75rem";

export const radii = {
  sm: "calc(0.75rem - 4px)",
  md: "calc(0.75rem - 2px)",
  lg: "0.75rem",
  xl: "calc(0.75rem + 4px)",
  "2xl": "calc(0.75rem + 8px)",
} as const;

/** React Native (px). */
export const radiiPx = {
  sm: 8,
  md: 10,
  lg: 12,
  xl: 16,
  "2xl": 20,
} as const;
