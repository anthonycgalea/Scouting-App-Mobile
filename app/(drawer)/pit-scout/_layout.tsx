import { Stack } from 'expo-router';

export default function PitScoutLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: 'Pit Scout' }} />
      <Stack.Screen
        name="team-details"
        options={{
          headerBackTitle: 'Back',
        }}
      />
    </Stack>
  );
}
