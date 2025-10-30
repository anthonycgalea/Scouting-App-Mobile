import { Stack } from 'expo-router';

export default function SuperScoutLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="select-alliance" options={{ presentation: 'card' }} />
    </Stack>
  );
}
