import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { DevToolsBootstrap } from "../components/DevToolsBootstrap";
import { OfflineSyncBootstrap } from "../components/OfflineSyncBootstrap";
import { PushBootstrap } from "../components/PushBootstrap";
import { SellerCacheBootstrap } from "../components/SellerCacheBootstrap";
import { SellerLocationReporter } from "../components/SellerLocationReporter";
import { AuthProvider } from "../context/AuthContext";
import { ConfirmProvider } from "../context/ConfirmContext";
import { ToastProvider } from "../context/ToastContext";
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
          name="forgot-password"
          options={{ title: "Esqueci a senha", headerShown: false }}
        />
        <Stack.Screen
          name="seller-access-block"
          options={{ title: "Acesso", headerShown: false }}
        />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="settings" options={{ headerShown: false }} />
        <Stack.Screen name="quick-sale" options={{ headerShown: false }} />
        <Stack.Screen name="customer" options={{ headerShown: false }} />
        <Stack.Screen name="commissions" options={{ headerShown: false }} />
        <Stack.Screen name="devtools" options={{ headerShown: false }} />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={qc}>
        <ThemeProvider>
          <ConfirmProvider>
            <ToastProvider>
              <DevToolsBootstrap>
                <AuthProvider>
                  <PushBootstrap />
                  <OfflineSyncBootstrap />
                  <SellerCacheBootstrap />
                  <SellerLocationReporter />
                  <RootStack />
                </AuthProvider>
              </DevToolsBootstrap>
            </ToastProvider>
          </ConfirmProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
