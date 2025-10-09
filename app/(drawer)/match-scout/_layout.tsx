import { Stack } from 'expo-router';

export default function MatchScoutLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="select-team" options={{ presentation: 'card' }} />
      <Stack.Screen name="begin-scouting" />
    </Stack>
  );
}
