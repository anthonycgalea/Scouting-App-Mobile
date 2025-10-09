import { Stack } from 'expo-router';

type BeginScoutingRouteParams = {
  teamNumber?: string | string[];
  matchNumber?: string | string[];
  eventKey?: string | string[];
  driverStation?: string | string[];
  matchLevel?: string | string[];
};

const toSingleValue = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value;

const getMatchLevelLabel = (matchLevel: string | undefined) => {
  const normalized = matchLevel?.toLowerCase();

  switch (normalized) {
    case 'qm':
      return 'Quals';
    case 'sf':
      return 'Semis';
    case 'qf':
      return 'Quarters';
    case 'f':
      return 'Finals';
    default:
      return matchLevel?.toUpperCase() ?? '';
  }
};

const buildMatchHeaderTitle = (params: BeginScoutingRouteParams) => {
  const eventKey = toSingleValue(params.eventKey);
  const matchNumber = toSingleValue(params.matchNumber);
  const teamNumber = toSingleValue(params.teamNumber);
  const driverStation = toSingleValue(params.driverStation);
  const matchLevel = toSingleValue(params.matchLevel);

  const hasPrefilledDetails = Boolean(eventKey && matchNumber && teamNumber && driverStation);

  if (!hasPrefilledDetails) {
    return 'Match Scout';
  }

  const levelLabel = getMatchLevelLabel(matchLevel);
  const matchPrefix = levelLabel || matchLevel;
  const matchLabel = matchPrefix ? `${matchPrefix} Match ${matchNumber}` : `Match ${matchNumber}`;

  return `${eventKey} ${matchLabel}: Team ${teamNumber} (${driverStation})`;
};

export default function MatchScoutLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="select-team" options={{ presentation: 'card' }} />
      <Stack.Screen
        name="begin-scouting"
        options={({ route }) => ({
          headerShown: true,
          title: buildMatchHeaderTitle((route.params ?? {}) as BeginScoutingRouteParams),
        })}
      />
    </Stack>
  );
}
