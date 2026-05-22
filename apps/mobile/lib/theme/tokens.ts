import { appColorsDark, appColorsLight } from "@pedidos/design-tokens";
import type { AppColorScheme, AppColors } from "./types";

export const themeColors: Record<AppColorScheme, AppColors> = {
  light: appColorsLight,
  dark: appColorsDark,
};

/** @deprecated use themeColors */
export const palette = {} as const;
