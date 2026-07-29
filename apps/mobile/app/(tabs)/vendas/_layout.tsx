import { Stack } from "expo-router";

export default function VendasStack() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="repeat" />
      <Stack.Screen name="offline-queue" />
      <Stack.Screen name="offline-edit/[localId]" />
      <Stack.Screen name="[id]" />
    </Stack>
  );
}
