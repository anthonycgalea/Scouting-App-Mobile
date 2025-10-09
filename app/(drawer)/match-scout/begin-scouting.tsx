import { useLayoutEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useLocalSearchParams, useNavigation } from 'expo-router';
import type { ParamListBase } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { ScreenContainer } from '@/components/layout/ScreenContainer';
import { ThemedText } from '@/components/themed-text';
import { useThemeColor } from '@/hooks/use-theme-color';

const toSingleValue = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value;

type BeginScoutingParams = {
  teamNumber?: string | string[];
  matchNumber?: string | string[];
  eventKey?: string | string[];
  driverStation?: string | string[];
  matchLevel?: string | string[];
  allianceColor?: string | string[];
  alliance_color?: string | string[];
  stationPosition?: string | string[];
  station_position?: string | string[];
  driverStationPosition?: string | string[];
  driver_station_position?: string | string[];
  team_number?: string | string[];
  match_number?: string | string[];
  event_key?: string | string[];
  match_level?: string | string[];
  driver_station?: string | string[];
};

type PhaseCounts = {
  coralL4: number;
  coralL3: number;
  coralL2: number;
  coralL1: number;
  net: number;
  processor: number;
};

type PhaseKey = keyof PhaseCounts;

type LimitConfig = Record<PhaseKey, { auto: number; teleop: number }>;

const limitConfig: LimitConfig = {
  coralL4: { auto: 12, teleop: 12 },
  coralL3: { auto: 12, teleop: 12 },
  coralL2: { auto: 12, teleop: 12 },
  coralL1: { auto: 10, teleop: 50 },
  net: { auto: 9, teleop: 18 },
  processor: { auto: 9, teleop: 18 },
};

const createInitialPhaseCounts = (): PhaseCounts => ({
  coralL4: 0,
  coralL3: 0,
  coralL2: 0,
  coralL1: 0,
  net: 0,
  processor: 0,
});

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

const toTitleCase = (value: string | undefined) => {
  if (!value) {
    return undefined;
  }

  const trimmed = value.trim();

  if (!trimmed) {
    return undefined;
  }

  return trimmed[0].toUpperCase() + trimmed.slice(1).toLowerCase();
};

const buildDriverStationLabel = (
  driverStation: string | undefined,
  allianceColor: string | undefined,
  stationPosition: string | undefined
) => {
  if (driverStation) {
    return driverStation;
  }

  if (!allianceColor) {
    return undefined;
  }

  const formattedColor = toTitleCase(allianceColor);
  const trimmedPosition = stationPosition?.trim();

  if (formattedColor && trimmedPosition) {
    return `${formattedColor} ${trimmedPosition}`;
  }

  return formattedColor ?? undefined;
};

const formatMatchHeader = (
  eventKey: string | undefined,
  matchLevel: string | undefined,
  matchNumber: string | undefined,
  teamNumber: string | undefined,
  driverStationLabel: string | undefined
) => {
  if (!eventKey || !matchNumber || !teamNumber || !driverStationLabel) {
    return undefined;
  }

  const levelLabel = getMatchLevelLabel(matchLevel);
  const matchPrefix = levelLabel || matchLevel;
  const matchLabel = matchPrefix ? `${matchPrefix} Match ${matchNumber}` : `Match ${matchNumber}`;

  return `${eventKey} ${matchLabel}: Team ${teamNumber} (${driverStationLabel})`;
};

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

interface CounterControlProps {
  label: string;
  value: number;
  onIncrement: () => void;
  onDecrement: () => void;
}

function CounterControl({ label, value, onIncrement, onDecrement }: CounterControlProps) {
  const cardBackground = useThemeColor({ light: '#F1F5F9', dark: '#1F2937' }, 'background');
  const borderColor = useThemeColor({ light: '#CBD5F5', dark: '#334155' }, 'background');
  const textColor = useThemeColor({}, 'text');
  const positiveBackground = useThemeColor({ light: '#2563EB', dark: '#1E3A8A' }, 'tint');
  const negativeBackground = useThemeColor({ light: '#DC2626', dark: '#B91C1C' }, 'tint');

  return (
    <View style={[styles.counterCard, { backgroundColor: cardBackground, borderColor }]}>
      <ThemedText type="defaultSemiBold" style={[styles.counterLabel, { color: textColor }]}>
        {label}
      </ThemedText>
      <View style={styles.counterButtons}>
        <Pressable
          accessibilityRole="button"
          onPress={onIncrement}
          style={({ pressed }) => [
            styles.counterButton,
            styles.counterButtonPositive,
            { backgroundColor: positiveBackground },
            pressed && styles.buttonPressed,
          ]}
        >
          <ThemedText type="title" style={styles.counterValue}>
            {value}
          </ThemedText>
          <ThemedText type="defaultSemiBold" style={styles.counterButtonAuxText}>
            +
          </ThemedText>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={onDecrement}
          style={({ pressed }) => [
            styles.counterButton,
            styles.counterButtonNegative,
            { backgroundColor: negativeBackground },
            pressed && styles.buttonPressed,
          ]}
        >
          <ThemedText type="defaultSemiBold" style={styles.counterButtonText}>
            -
          </ThemedText>
        </Pressable>
      </View>
    </View>
  );
}

export default function BeginScoutingRoute() {
  const params = useLocalSearchParams<BeginScoutingParams>();
  const navigation = useNavigation<NativeStackNavigationProp<ParamListBase>>();

  const eventKey =
    toSingleValue(params.eventKey) ?? toSingleValue(params.event_key) ?? '';
  const matchLevel =
    toSingleValue(params.matchLevel) ?? toSingleValue(params.match_level);
  const initialMatchNumber =
    toSingleValue(params.matchNumber) ?? toSingleValue(params.match_number) ?? '';
  const initialTeamNumber =
    toSingleValue(params.teamNumber) ?? toSingleValue(params.team_number) ?? '';
  const driverStation = toSingleValue(params.driverStation) ?? toSingleValue(params.driver_station);
  const allianceColor =
    toSingleValue(params.allianceColor) ?? toSingleValue(params.alliance_color);
  const stationPosition =
    toSingleValue(params.stationPosition) ??
    toSingleValue(params.station_position) ??
    toSingleValue(params.driverStationPosition) ??
    toSingleValue(params.driver_station_position);
  const driverStationLabel = buildDriverStationLabel(driverStation, allianceColor, stationPosition);

  const [teamNumber, setTeamNumber] = useState(initialTeamNumber);
  const [matchNumber, setMatchNumber] = useState(initialMatchNumber);
  const [isAuto, setIsAuto] = useState(true);
  const [autoCounts, setAutoCounts] = useState<PhaseCounts>(() => createInitialPhaseCounts());
  const [teleCounts, setTeleCounts] = useState<PhaseCounts>(() => createInitialPhaseCounts());

  const inputBackground = useThemeColor({ light: '#FFFFFF', dark: '#0F172A' }, 'background');
  const inputBorder = useThemeColor({ light: '#CBD5F5', dark: '#334155' }, 'background');
  const textColor = useThemeColor({}, 'text');
  const toggleContainerBackground = useThemeColor({ light: '#E2E8F0', dark: '#1F2937' }, 'background');
  const toggleActiveBackground = useThemeColor({ light: '#2563EB', dark: '#1E3A8A' }, 'tint');
  const toggleActiveTextColor = '#F8FAFC';

  const currentCounts = isAuto ? autoCounts : teleCounts;
  const hasPrefilledDetails = useMemo(
    () => Boolean(eventKey && initialMatchNumber && initialTeamNumber && driverStationLabel),
    [driverStationLabel, eventKey, initialMatchNumber, initialTeamNumber]
  );
  const matchDetailsTitle = useMemo(
    () =>
      formatMatchHeader(eventKey, matchLevel, initialMatchNumber, initialTeamNumber, driverStationLabel),
    [driverStationLabel, eventKey, initialMatchNumber, initialTeamNumber, matchLevel]
  );

  useLayoutEffect(() => {
    const headerTitle = matchDetailsTitle ?? 'match-scout';
    const parentNavigation = navigation.getParent?.();
    const drawerNavigation = parentNavigation?.getParent?.();

    navigation.setOptions({
      headerTitle,
      title: headerTitle,
    });

    parentNavigation?.setOptions?.({
      headerTitle,
      title: headerTitle,
    });

    drawerNavigation?.setOptions?.({
      headerTitle,
      title: headerTitle,
    });

    return () => {
      const resetTitle = 'match-scout';

      navigation.setOptions({ headerTitle: resetTitle, title: resetTitle });
      parentNavigation?.setOptions?.({ headerTitle: resetTitle, title: resetTitle });
      drawerNavigation?.setOptions?.({ headerTitle: resetTitle, title: resetTitle });
    };
  }, [navigation, matchDetailsTitle]);

  const handleAdjust = (key: PhaseKey, delta: 1 | -1) => {
    const limit = isAuto ? limitConfig[key].auto : limitConfig[key].teleop;
    const setCounts = isAuto ? setAutoCounts : setTeleCounts;

    setCounts((prev) => {
      const nextValue = clamp(prev[key] + delta, 0, limit);

      if (nextValue === prev[key]) {
        return prev;
      }

      return {
        ...prev,
        [key]: nextValue,
      };
    });
  };

  const phaseLabel = isAuto ? 'Auto' : 'Teleop';

  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {!matchDetailsTitle && eventKey ? (
          <View style={styles.header}>
            <ThemedText type="defaultSemiBold">Event: {eventKey}</ThemedText>
          </View>
        ) : null}

        {!hasPrefilledDetails ? (
          <View style={styles.formGrid}>
            <View style={styles.inputGroup}>
              <ThemedText type="defaultSemiBold">Team Number</ThemedText>
              <TextInput
                value={teamNumber}
                onChangeText={setTeamNumber}
                keyboardType="number-pad"
                placeholder="Team Number"
                placeholderTextColor="#94A3B8"
                style={[styles.input, { backgroundColor: inputBackground, borderColor: inputBorder, color: textColor }]}
              />
            </View>
            <View style={styles.inputGroup}>
              <ThemedText type="defaultSemiBold">Match Number</ThemedText>
              <TextInput
                value={matchNumber}
                onChangeText={setMatchNumber}
                keyboardType="number-pad"
                placeholder="Match Number"
                placeholderTextColor="#94A3B8"
                style={[styles.input, { backgroundColor: inputBackground, borderColor: inputBorder, color: textColor }]}
              />
            </View>
          </View>
        ) : null}

        <View
          style={[
            styles.phaseToggle,
            { backgroundColor: toggleContainerBackground, borderColor: inputBorder },
          ]}
        >
          <Pressable
            accessibilityRole="button"
            onPress={() => setIsAuto(true)}
            style={({ pressed }) => [
              styles.phaseToggleButton,
              { backgroundColor: isAuto ? toggleActiveBackground : 'transparent' },
              pressed && styles.buttonPressed,
            ]}
          >
            <ThemedText
              type="defaultSemiBold"
              style={[
                styles.phaseToggleText,
                { color: isAuto ? toggleActiveTextColor : textColor },
              ]}
            >
              Auto
            </ThemedText>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={() => setIsAuto(false)}
            style={({ pressed }) => [
              styles.phaseToggleButton,
              { backgroundColor: !isAuto ? toggleActiveBackground : 'transparent' },
              pressed && styles.buttonPressed,
            ]}
          >
            <ThemedText
              type="defaultSemiBold"
              style={[
                styles.phaseToggleText,
                { color: !isAuto ? toggleActiveTextColor : textColor },
              ]}
            >
              Teleop
            </ThemedText>
          </Pressable>
        </View>

        <View style={styles.section}>
          <ThemedText type="defaultSemiBold" style={styles.sectionTitle}>
            {phaseLabel} Counters
          </ThemedText>
          <View style={styles.counterGrid}>
            <View style={styles.counterColumn}>
              <CounterControl
                label={`Coral L4`}
                value={currentCounts.coralL4}
                onIncrement={() => handleAdjust('coralL4', 1)}
                onDecrement={() => handleAdjust('coralL4', -1)}
              />
              <CounterControl
                label={`Coral L3`}
                value={currentCounts.coralL3}
                onIncrement={() => handleAdjust('coralL3', 1)}
                onDecrement={() => handleAdjust('coralL3', -1)}
              />
              <CounterControl
                label={`Coral L2`}
                value={currentCounts.coralL2}
                onIncrement={() => handleAdjust('coralL2', 1)}
                onDecrement={() => handleAdjust('coralL2', -1)}
              />
              <CounterControl
                label={`Coral L1`}
                value={currentCounts.coralL1}
                onIncrement={() => handleAdjust('coralL1', 1)}
                onDecrement={() => handleAdjust('coralL1', -1)}
              />
            </View>
            <View style={styles.counterColumn}>
              <CounterControl
                label={`Processor`}
                value={currentCounts.processor}
                onIncrement={() => handleAdjust('processor', 1)}
                onDecrement={() => handleAdjust('processor', -1)}
              />
              <CounterControl
                label={`Net`}
                value={currentCounts.net}
                onIncrement={() => handleAdjust('net', 1)}
                onDecrement={() => handleAdjust('net', -1)}
              />
            </View>
          </View>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    padding: 20,
    gap: 24,
  },
  header: {
    gap: 4,
    alignItems: 'center',
  },
  formGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  inputGroup: {
    flexBasis: '48%',
    gap: 8,
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    fontSize: 16,
  },
  phaseToggle: {
    flexDirection: 'row',
    borderRadius: 999,
    overflow: 'hidden',
    borderWidth: 1,
    alignSelf: 'center',
  },
  phaseToggleButton: {
    paddingVertical: 12,
    paddingHorizontal: 32,
  },
  phaseToggleText: {
    fontSize: 16,
  },
  section: {
    gap: 16,
  },
  sectionTitle: {
    fontSize: 18,
    textAlign: 'center',
  },
  counterGrid: {
    flexDirection: 'row',
    gap: 16,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  counterColumn: {
    flex: 1,
    gap: 16,
  },
  counterCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    gap: 12,
    alignItems: 'stretch',
    minWidth: 150,
  },
  counterLabel: {
    fontSize: 16,
    textAlign: 'center',
  },
  counterValue: {
    fontSize: 28,
    color: '#F8FAFC',
  },
  counterButtons: {
    flexDirection: 'column',
    gap: 0,
    width: '100%',
    flexGrow: 1,
    minHeight: 180,
    borderRadius: 12,
    overflow: 'hidden',
  },
  counterButton: {
    borderRadius: 12,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  counterButtonPositive: {
    flex: 3,
    gap: 8,
    paddingVertical: 16,
  },
  counterButtonNegative: {
    flex: 1,
    paddingVertical: 10,
  },
  counterButtonText: {
    color: '#F8FAFC',
    fontSize: 20,
  },
  counterButtonAuxText: {
    color: '#BFDBFE',
    fontSize: 18,
  },
  buttonPressed: {
    opacity: 0.85,
  },
});
