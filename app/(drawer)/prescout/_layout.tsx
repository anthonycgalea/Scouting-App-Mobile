import { Stack } from 'expo-router';

export default function PrescoutLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: 'Prescout' }} />
    </Stack>
  );
}
