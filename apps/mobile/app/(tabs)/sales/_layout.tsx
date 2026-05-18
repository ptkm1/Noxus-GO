import { Stack } from "expo-router";

export default function SalesStack() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: "Minhas vendas" }} />
      <Stack.Screen name="offline-queue" options={{ title: "Fila offline" }} />
      <Stack.Screen name="[id]" options={{ title: "Detalhe da venda" }} />
    </Stack>
  );
}
