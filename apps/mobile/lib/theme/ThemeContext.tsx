import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useColorScheme as useSystemColorScheme } from "react-native";
import { loadThemePreference, saveThemePreference } from "./preference";
import { themeColors } from "./tokens";
import type { AppColorScheme, AppTheme, ThemePreference } from "./types";

type ThemeContextValue = AppTheme & {
  setPreference: (next: ThemePreference) => void;
  isReady: boolean;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function resolveColorScheme(
  preference: ThemePreference,
  system: string | null | undefined,
): AppColorScheme {
  if (preference === "light" || preference === "dark") return preference;
  return system === "dark" ? "dark" : "light";
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const systemScheme = useSystemColorScheme();
  const [preference, setPreferenceState] = useState<ThemePreference>("system");
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    void loadThemePreference().then((stored) => {
      setPreferenceState(stored);
      setIsReady(true);
    });
  }, []);

  const setPreference = useCallback((next: ThemePreference) => {
    setPreferenceState(next);
    void saveThemePreference(next);
  }, []);

  const colorScheme = resolveColorScheme(preference, systemScheme);
  const colors = themeColors[colorScheme];

  const value = useMemo<ThemeContextValue>(
    () => ({
      colorScheme,
      preference,
      colors,
      isDark: colorScheme === "dark",
      setPreference,
      isReady,
    }),
    [colorScheme, preference, colors, setPreference, isReady],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return ctx;
}
