import { Stack } from "expo-router";

export default function SalesStack() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="offline-queue" />
      <Stack.Screen name="[id]" />
    </Stack>
  );
}
