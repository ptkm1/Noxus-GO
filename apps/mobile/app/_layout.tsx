import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { DevToolsBootstrap } from "../components/DevToolsBootstrap";
import { OfflineSyncBootstrap } from "../components/OfflineSyncBootstrap";
import { SellerLocationReporter } from "../components/SellerLocationReporter";
import { AuthProvider } from "../context/AuthContext";
import { ThemeProvider, useTheme } from "../lib/theme";

const qc = new QueryClient();

function RootStack() {
  const { colors, isDark } = useTheme();

  return (
    <>
      <StatusBar style={isDark ? "light" : "dark"} />
      <Stack
        screenOptions={{
          headerShown: true,
          headerBackTitle: "Voltar",
          headerStyle: { backgroundColor: colors.headerBackground },
          headerTintColor: colors.primary,
          headerTitleStyle: { color: colors.headerTitle, fontWeight: "600" },
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen
          name="login"
          options={{ title: "Entrar", headerShown: false }}
        />
        <Stack.Screen
          name="seller-access-block"
          options={{ title: "Acesso", headerShown: false }}
        />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="settings" options={{ headerShown: false }} />
        <Stack.Screen name="quick-sale" options={{ headerShown: false }} />
        <Stack.Screen name="customer" options={{ headerShown: false }} />
        <Stack.Screen name="devtools" options={{ title: "DevTools" }} />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <QueryClientProvider client={qc}>
      <ThemeProvider>
        <DevToolsBootstrap>
          <AuthProvider>
            <OfflineSyncBootstrap />
            <SellerLocationReporter />
            <RootStack />
          </AuthProvider>
        </DevToolsBootstrap>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
