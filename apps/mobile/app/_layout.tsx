import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import { OfflineSyncBootstrap } from "../components/OfflineSyncBootstrap";
import { AuthProvider } from "../context/AuthContext";

const qc = new QueryClient();

export default function RootLayout() {
  return (
    <QueryClientProvider client={qc}>
      <AuthProvider>
        <OfflineSyncBootstrap />
        <Stack screenOptions={{ headerShown: true, headerBackTitle: "Voltar" }}>
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Screen name="login" options={{ title: "Entrar", headerShown: false }} />
          <Stack.Screen name="seller-access-block" options={{ title: "Acesso", headerShown: false }} />
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="settings" options={{ title: "Configurações" }} />
          <Stack.Screen name="quick-sale" options={{ title: "Venda rápida" }} />
          <Stack.Screen name="customer/[id]" options={{ title: "Crédito do cliente" }} />
        </Stack>
      </AuthProvider>
    </QueryClientProvider>
  );
}
