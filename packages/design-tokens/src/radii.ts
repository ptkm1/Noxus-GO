/** Raio do tema (~10px / 0.625rem). */
export const radiusBase = "0.625rem";

export const radii = {
  sm: "calc(0.625rem - 4px)",
  md: "calc(0.625rem - 2px)",
  lg: "0.625rem",
  xl: "calc(0.625rem + 4px)",
  "2xl": "calc(0.625rem + 8px)",
} as const;

/** React Native (px). */
export const radiiPx = {
  sm: 6,
  md: 8,
  lg: 10,
  xl: 14,
  "2xl": 18,
} as const;
