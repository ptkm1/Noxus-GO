import { Stack } from "expo-router";

export default function CustomerLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="form" />
      <Stack.Screen name="[id]/index" />
      <Stack.Screen name="[id]/credit" />
    </Stack>
  );
}
