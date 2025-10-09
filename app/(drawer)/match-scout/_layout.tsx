import { Stack } from 'expo-router';

import { buildMatchHeaderTitle, type MatchHeaderParams } from '../../utils/match-header';

export default function MatchScoutLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="select-team" options={{ presentation: 'card' }} />
      <Stack.Screen
        name="begin-scouting"
        options={({ route }) => {
          const headerTitle = buildMatchHeaderTitle(route.params as MatchHeaderParams | undefined);

          return {
            headerShown: true,
            headerTitle,
            headerLargeTitle: false,
            headerBackTitleVisible: false,
            headerBackTitle: '',
          };
        }}
      />
    </Stack>
  );
}
