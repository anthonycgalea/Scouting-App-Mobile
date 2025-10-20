import type { ParamListBase } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { and, eq } from 'drizzle-orm';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { useEffect, useLayoutEffect, useMemo, useState } from 'react';
import {
  Alert,
  Keyboard,
  Pressable,
  StyleSheet,
  TextInput,
  TouchableWithoutFeedback,
  View,
} from 'react-native';

import { getDbOrThrow, schema } from '@/db';
import type { MatchSchedule } from '@/db/schema';
import { syncAlreadyScoutedEntries } from '../../services/already-scouted';
import { apiRequest } from '../../services/api';
import { getActiveEvent } from '../../services/logged-in-event';

import { ScreenContainer } from '@/components/layout/ScreenContainer';
import { ThemedText } from '@/components/themed-text';
import { useOrganization } from '@/hooks/use-organization';
import { useThemeColor } from '@/hooks/use-theme-color';

const toSingleValue = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value;

const parseInteger = (value: string | undefined) => {
  if (!value) {
    return Number.NaN;
  }

  const trimmed = value.trim();

  if (!trimmed) {
    return Number.NaN;
  }

  const parsed = Number.parseInt(trimmed, 10);

  return Number.isNaN(parsed) ? Number.NaN : parsed;
};

type BeginScoutingParams = {
  mode?: string | string[];
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
      return 'Qualification';
    case 'sf':
      return 'Playoff';
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

const DRIVER_STATION_SLOTS = ['red1', 'red2', 'red3', 'blue1', 'blue2', 'blue3'] as const;
type DriverStationSlot = (typeof DRIVER_STATION_SLOTS)[number];
type DriverStationColumn = keyof Pick<
  MatchSchedule,
  'red1Id' | 'red2Id' | 'red3Id' | 'blue1Id' | 'blue2Id' | 'blue3Id'
>;

const DRIVER_STATION_COLUMN_MAP: Record<DriverStationSlot, DriverStationColumn> = {
  red1: 'red1Id',
  red2: 'red2Id',
  red3: 'red3Id',
  blue1: 'blue1Id',
  blue2: 'blue2Id',
  blue3: 'blue3Id',
};

const isDriverStationSlot = (value: string): value is DriverStationSlot =>
  DRIVER_STATION_SLOTS.includes(value as DriverStationSlot);

const formatDriverStationLabelFromSlot = (slot: DriverStationSlot) => {
  const color = slot.startsWith('red') ? 'Red' : 'Blue';
  const position = slot.slice(-1);

  return `${color} ${position}`;
};

const parseDriverStationSlot = ({
  driverStationLabel,
  allianceColor,
  stationPosition,
}: {
  driverStationLabel?: string;
  allianceColor?: string | null;
  stationPosition?: string | null;
}): DriverStationSlot | undefined => {
  const normalizedAlliance = allianceColor?.trim().toLowerCase();
  const normalizedPosition = stationPosition?.trim().match(/\d/);

  if (normalizedAlliance && normalizedPosition) {
    const candidate = `${normalizedAlliance}${normalizedPosition[0]}`;

    if (isDriverStationSlot(candidate)) {
      return candidate;
    }
  }

  const normalizedLabel = driverStationLabel?.trim().toLowerCase();

  if (normalizedLabel) {
    const labelMatch = normalizedLabel.match(/(red|blue)\s*([123])/);

    if (labelMatch) {
      const candidate = `${labelMatch[1]}${labelMatch[2]}`;

      if (isDriverStationSlot(candidate)) {
        return candidate;
      }
    }
  }

  return undefined;
};

const MATCH_LEVEL_SORT_ORDER = ['qm', 'ef', 'of', 'qf', 'sf', 'f'] as const;

const getMatchLevelPriority = (matchLevel: string) => {
  const normalized = (matchLevel ?? '').trim().toLowerCase();
  const index = MATCH_LEVEL_SORT_ORDER.indexOf(normalized as (typeof MATCH_LEVEL_SORT_ORDER)[number]);

  return index === -1 ? MATCH_LEVEL_SORT_ORDER.length : index;
};

const buildNextMatchParams = (
  schedule: MatchSchedule[],
  {
    eventKey,
    currentMatchLevel,
    currentMatchNumber,
    driverStationSlot,
    driverStationLabel,
  }: {
    eventKey: string;
    currentMatchLevel: string;
    currentMatchNumber: number;
    driverStationSlot: DriverStationSlot;
    driverStationLabel?: string;
  },
) => {
  const relevantMatches = schedule
    .filter((match) => match.eventKey === eventKey)
    .sort((a, b) => {
      const levelDelta = getMatchLevelPriority(a.matchLevel) - getMatchLevelPriority(b.matchLevel);

      if (levelDelta !== 0) {
        return levelDelta;
      }

      return a.matchNumber - b.matchNumber;
    });

  const normalizedCurrentLevel = (currentMatchLevel ?? '').trim().toLowerCase();
  const currentIndex = relevantMatches.findIndex(
    (match) =>
      match.matchNumber === currentMatchNumber &&
      (match.matchLevel ?? '').trim().toLowerCase() === normalizedCurrentLevel,
  );

  if (currentIndex === -1) {
    return null;
  }

  const columnKey = DRIVER_STATION_COLUMN_MAP[driverStationSlot];

  for (let index = currentIndex + 1; index < relevantMatches.length; index += 1) {
    const candidate = relevantMatches[index];
    const candidateLevel = (candidate.matchLevel ?? '').trim().toLowerCase();

    if (candidateLevel !== normalizedCurrentLevel) {
      break;
    }

    const teamNumber = candidate[columnKey];

    if (typeof teamNumber === 'number' && Number.isFinite(teamNumber)) {
      const allianceColor = driverStationSlot.startsWith('red') ? 'red' : 'blue';
      const stationPosition = driverStationSlot.slice(-1);
      const label = driverStationLabel ?? formatDriverStationLabelFromSlot(driverStationSlot);

      return {
        eventKey: candidate.eventKey,
        event_key: candidate.eventKey,
        matchLevel: candidate.matchLevel,
        match_level: candidate.matchLevel,
        matchNumber: String(candidate.matchNumber),
        match_number: String(candidate.matchNumber),
        teamNumber: String(teamNumber),
        team_number: String(teamNumber),
        driverStation: label,
        driver_station: label,
        allianceColor,
        alliance_color: allianceColor,
        stationPosition,
        station_position: stationPosition,
        driverStationPosition: stationPosition,
        driver_station_position: stationPosition,
      } satisfies Record<string, string>;
    }
  }

  return null;
};

interface CounterControlProps {
  label: string;
  value: number;
  onIncrement: () => void;
  onDecrement: () => void;
}

function CounterControl({ label, value, onIncrement, onDecrement }: CounterControlProps) {
  const positiveBackground = useThemeColor({ light: '#475569', dark: '#1F2937' }, 'background');
  const negativeBackground = useThemeColor({ light: '#334155', dark: '#111827' }, 'background');

  return (
    <View style={styles.counterControl}>
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
          <ThemedText type="defaultSemiBold" style={styles.counterLabel}>
            {label}
          </ThemedText>
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

interface TabTransitionControlProps {
  incrementLabel: string;
  decrementLabel: string;
  onIncrement: () => void;
  onDecrement: () => void;
}

function TabTransitionControl({
  incrementLabel,
  decrementLabel,
  onIncrement,
  onDecrement,
}: TabTransitionControlProps) {
  const positiveBackground = useThemeColor({ light: '#475569', dark: '#1F2937' }, 'background');
  const negativeBackground = useThemeColor({ light: '#CBD5F5', dark: '#0F172A' }, 'background');
  const negativeText = useThemeColor({ light: '#1F2937', dark: '#CBD5F5' }, 'text');

  return (
    <View style={[styles.counterControl, styles.tabTransitionControl]}>
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
          <ThemedText type="defaultSemiBold" style={styles.tabTransitionHeading}>
            Next
          </ThemedText>
          <ThemedText type="title" style={styles.tabTransitionLabel}>
            {incrementLabel}
          </ThemedText>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={onDecrement}
          style={({ pressed }) => [
            styles.counterButton,
            styles.counterButtonNegative,
            styles.tabTransitionBackButton,
            { backgroundColor: negativeBackground, borderColor: negativeText },
            pressed && styles.buttonPressed,
          ]}
        >
          <ThemedText
            type="defaultSemiBold"
            style={[styles.tabTransitionBackLabel, { color: negativeText }]}
          >
            {decrementLabel}
          </ThemedText>
        </Pressable>
      </View>
    </View>
  );
}

export default function BeginScoutingRoute() {
  const params = useLocalSearchParams<BeginScoutingParams>();
  const navigation = useNavigation<NativeStackNavigationProp<ParamListBase>>();
  const router = useRouter();

  const mode = toSingleValue(params.mode);
  const isPrescoutMode = mode === 'prescout';
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

  const [activeEventFallback] = useState(() => getActiveEvent() ?? '');
  const resolvedEventKey = eventKey || activeEventFallback;
  const resolvedMatchLevelForDisplay = isPrescoutMode ? 'qm' : matchLevel;

  const [teamNumber, setTeamNumber] = useState(initialTeamNumber);
  const [matchNumber, setMatchNumber] = useState(initialMatchNumber);
  const [selectedTab, setSelectedTab] = useState<'info' | 'auto' | 'teleop' | 'endgame'>('info');
  const [autoCounts, setAutoCounts] = useState<PhaseCounts>(() => createInitialPhaseCounts());
  const [teleCounts, setTeleCounts] = useState<PhaseCounts>(() => createInitialPhaseCounts());
  const [endgameSelection, setEndgameSelection] = useState<'none' | 'park' | 'shallow' | 'deep'>('none');
  const [generalNotes, setGeneralNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { selectedOrganization } = useOrganization();

  const resetPrescoutForm = (nextMatchNumberValue: number) => {
    setSelectedTab('info');
    setAutoCounts(createInitialPhaseCounts());
    setTeleCounts(createInitialPhaseCounts());
    setEndgameSelection('none');
    setGeneralNotes('');
    setMatchNumber(String(nextMatchNumberValue));
  };

  const inputBackground = useThemeColor({ light: '#FFFFFF', dark: '#0F172A' }, 'background');
  const inputBorder = useThemeColor({ light: '#CBD5F5', dark: '#334155' }, 'background');
  const textColor = useThemeColor({}, 'text');
  const toggleContainerBackground = useThemeColor({ light: '#E2E8F0', dark: '#1F2937' }, 'background');
  const toggleActiveBackground = useThemeColor({ light: '#2563EB', dark: '#1E3A8A' }, 'tint');
  const toggleActiveTextColor = '#F8FAFC';
  const tabInactiveTextColor = useThemeColor({ light: '#334155', dark: '#CBD5F5' }, 'text');

  const isAutoTab = selectedTab === 'auto';
  const isTeleopTab = selectedTab === 'teleop';
  const currentCounts = isAutoTab ? autoCounts : teleCounts;
  const hasPrefilledDetails = useMemo(() => {
    if (isPrescoutMode) {
      return Boolean(
        resolvedEventKey &&
          (matchNumber || initialMatchNumber) &&
          (teamNumber || initialTeamNumber),
      );
    }

    return Boolean(
      resolvedEventKey && initialMatchNumber && initialTeamNumber && driverStationLabel,
    );
  }, [
    driverStationLabel,
    initialMatchNumber,
    initialTeamNumber,
    isPrescoutMode,
    matchNumber,
    resolvedEventKey,
    teamNumber,
  ]);
  const matchDetailsTitle = useMemo(() => {
    const matchNumberForHeader = isPrescoutMode
      ? matchNumber || initialMatchNumber
      : initialMatchNumber;
    const teamNumberForHeader = teamNumber || initialTeamNumber;
    const matchLevelForHeader = resolvedMatchLevelForDisplay;

    return formatMatchHeader(
      resolvedEventKey,
      matchLevelForHeader,
      matchNumberForHeader,
      teamNumberForHeader,
      driverStationLabel,
    );
  }, [
    driverStationLabel,
    initialMatchNumber,
    initialTeamNumber,
    isPrescoutMode,
    matchNumber,
    resolvedEventKey,
    resolvedMatchLevelForDisplay,
    teamNumber,
  ]);

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
    const limit = isAutoTab ? limitConfig[key].auto : limitConfig[key].teleop;
    const setCounts = isAutoTab ? setAutoCounts : setTeleCounts;

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

  const infoTeamNumber = teamNumber || initialTeamNumber || '---';
  const infoMatchNumber = matchNumber || initialMatchNumber || '---';
  const infoDetails = [
    { label: 'Team Number', value: infoTeamNumber },
    { label: 'Match Number', value: infoMatchNumber },
    { label: 'Event', value: resolvedEventKey || 'Not specified' },
    { label: 'Driver Station', value: driverStationLabel ?? 'Not specified' },
  ];
  const tabOptions = [
    { key: 'info', label: 'Info' },
    { key: 'auto', label: 'Auto' },
    { key: 'teleop', label: 'Teleop' },
    { key: 'endgame', label: 'Endgame' },
  ] as const;
  const endgameOptions = [
    { key: 'none', label: 'None' },
    { key: 'park', label: 'Park' },
    { key: 'shallow', label: 'Shallow Climb' },
    { key: 'deep', label: 'Deep Climb' },
  ] as const;

  useEffect(() => {
    if (!isPrescoutMode) {
      return;
    }

    const normalizedEventKey = resolvedEventKey.trim();
    const teamNumberCandidate = (teamNumber || initialTeamNumber).trim();

    if (!normalizedEventKey || !teamNumberCandidate) {
      return;
    }

    const parsedTeamNumber = parseInteger(teamNumberCandidate);

    if (Number.isNaN(parsedTeamNumber)) {
      return;
    }

    const db = getDbOrThrow();
    const existingMatches = db
      .select({ matchNumber: schema.prescoutMatchData2025.matchNumber })
      .from(schema.prescoutMatchData2025)
      .where(
        and(
          eq(schema.prescoutMatchData2025.eventKey, normalizedEventKey),
          eq(schema.prescoutMatchData2025.teamNumber, parsedTeamNumber),
        ),
      )
      .all();

    const nextMatchNumber =
      existingMatches.reduce((max, row) => Math.max(max, row.matchNumber ?? 0), 0) + 1;
    const nextMatchNumberValue = String(nextMatchNumber);

    if (matchNumber !== nextMatchNumberValue) {
      setMatchNumber(nextMatchNumberValue);
    }
  }, [
    initialTeamNumber,
    isPrescoutMode,
    matchNumber,
    resolvedEventKey,
    teamNumber,
  ]);

  const handleSubmit = async () => {
    if (isSubmitting) {
      return;
    }

    if (!selectedOrganization && !isPrescoutMode) {
      Alert.alert(
        'Select an organization',
        'Choose the organization you are scouting for before submitting match data.'
      );
      return;
    }

    const normalizedEventKey = resolvedEventKey.trim();
    const resolvedMatchLevel = isPrescoutMode ? 'qm' : matchLevel?.trim();
    const resolvedTeamNumber = teamNumber || initialTeamNumber;

    const parsedTeamNumber = parseInteger(resolvedTeamNumber);
    const parsedMatchNumber = parseInteger(matchNumber || initialMatchNumber);

    if (!normalizedEventKey) {
      Alert.alert(
        isPrescoutMode ? 'No event selected' : 'Missing match details',
        isPrescoutMode
          ? 'Select an event before submitting prescout data.'
          : 'An event key and match level are required before submitting match data.',
      );
      return;
    }

    if (!resolvedMatchLevel) {
      Alert.alert(
        'Missing match details',
        'A match level is required before submitting match data.'
      );
      return;
    }

    if (Number.isNaN(parsedTeamNumber)) {
      Alert.alert(
        'Invalid match details',
        'Team number must be a valid number before submitting match data.'
      );
      return;
    }

    if (!isPrescoutMode && Number.isNaN(parsedMatchNumber)) {
      Alert.alert(
        'Invalid match details',
        'Team number and match number must be valid numbers before submitting match data.'
      );
      return;
    }

    const noteValue = generalNotes.trim();
    const normalizedNotes = noteValue.length > 0 ? noteValue : "";

    const endgameMap = {
      none: 'NONE',
      park: 'PARK',
      shallow: 'SHALLOW',
      deep: 'DEEP',
    } as const;

    const endgameValue = endgameMap[endgameSelection];

    setIsSubmitting(true);

    try {
      const db = getDbOrThrow();
      const sharedRecordFields = {
        eventKey: normalizedEventKey,
        teamNumber: parsedTeamNumber,
        matchLevel: resolvedMatchLevel,
        notes: normalizedNotes,
        al4c: autoCounts.coralL4,
        al3c: autoCounts.coralL3,
        al2c: autoCounts.coralL2,
        al1c: autoCounts.coralL1,
        tl4c: teleCounts.coralL4,
        tl3c: teleCounts.coralL3,
        tl2c: teleCounts.coralL2,
        tl1c: teleCounts.coralL1,
        aProcessor: autoCounts.processor,
        tProcessor: teleCounts.processor,
        aNet: autoCounts.net,
        tNet: teleCounts.net,
        endgame: endgameValue,
      } as const;

      if (isPrescoutMode) {
        const existingMatches = db
          .select({ matchNumber: schema.prescoutMatchData2025.matchNumber })
          .from(schema.prescoutMatchData2025)
          .where(
            and(
              eq(schema.prescoutMatchData2025.eventKey, normalizedEventKey),
              eq(schema.prescoutMatchData2025.teamNumber, parsedTeamNumber),
            ),
          )
          .all();

        const nextMatchNumber =
          existingMatches.reduce((max, row) => Math.max(max, row.matchNumber ?? 0), 0) + 1;

        const prescoutRecord: typeof schema.prescoutMatchData2025.$inferInsert = {
          ...sharedRecordFields,
          matchNumber: nextMatchNumber,
        };

        await db
          .insert(schema.prescoutMatchData2025)
          .values(prescoutRecord)
          .onConflictDoUpdate({
            target: [
              schema.prescoutMatchData2025.eventKey,
              schema.prescoutMatchData2025.teamNumber,
              schema.prescoutMatchData2025.matchNumber,
              schema.prescoutMatchData2025.matchLevel,
            ],
            set: {
              notes: prescoutRecord.notes,
              al4c: prescoutRecord.al4c,
              al3c: prescoutRecord.al3c,
              al2c: prescoutRecord.al2c,
              al1c: prescoutRecord.al1c,
              tl4c: prescoutRecord.tl4c,
              tl3c: prescoutRecord.tl3c,
              tl2c: prescoutRecord.tl2c,
              tl1c: prescoutRecord.tl1c,
              aProcessor: prescoutRecord.aProcessor,
              tProcessor: prescoutRecord.tProcessor,
              aNet: prescoutRecord.aNet,
              tNet: prescoutRecord.tNet,
              endgame: prescoutRecord.endgame,
            },
          })
          .run();

        const [row] = await db
          .select()
          .from(schema.prescoutMatchData2025)
          .where(
            and(
              eq(schema.prescoutMatchData2025.eventKey, normalizedEventKey),
              eq(schema.prescoutMatchData2025.teamNumber, parsedTeamNumber),
              eq(schema.prescoutMatchData2025.matchNumber, nextMatchNumber),
              eq(schema.prescoutMatchData2025.matchLevel, resolvedMatchLevel),
            ),
          )
          .limit(1);

        if (!row) {
          throw new Error('Failed to retrieve submitted prescout data.');
        }

        resetPrescoutForm(nextMatchNumber + 1);

        try {
          const abortController = new AbortController();
          const timeoutId = setTimeout(() => abortController.abort(), 5000);

          try {
            await apiRequest('/scout/prescout', {
              method: 'POST',
              body: JSON.stringify(row),
              signal: abortController.signal,
            });
          } finally {
            clearTimeout(timeoutId);
          }

          Alert.alert('Prescout submitted', 'Prescout data was saved and sent successfully.', [
            {
              text: 'OK',
            },
          ]);
        } catch (error) {
          console.error('Failed to submit prescout data to API', error);
          Alert.alert(
            'Prescout saved locally',
            'The prescout data was saved on this device but could not be sent to the server.',
            [
              {
                text: 'OK',
              },
            ],
          );
        }

        return;
      }

      const record: typeof schema.matchData2025.$inferInsert = {
        ...sharedRecordFields,
        matchNumber: parsedMatchNumber,
      };

      await db
        .insert(schema.matchData2025)
        .values(record)
        .onConflictDoUpdate({
          target: [
            schema.matchData2025.eventKey,
            schema.matchData2025.teamNumber,
            schema.matchData2025.matchNumber,
            schema.matchData2025.matchLevel,
          ],
          set: {
            notes: record.notes,
            al4c: record.al4c,
            al3c: record.al3c,
            al2c: record.al2c,
            al1c: record.al1c,
            tl4c: record.tl4c,
            tl3c: record.tl3c,
            tl2c: record.tl2c,
            tl1c: record.tl1c,
            aProcessor: record.aProcessor,
            tProcessor: record.tProcessor,
            aNet: record.aNet,
            tNet: record.tNet,
            endgame: record.endgame,
          },
        })
        .run();

      await db
        .insert(schema.alreadyScouteds)
        .values({
          eventCode: normalizedEventKey,
          teamNumber: parsedTeamNumber,
          matchNumber: parsedMatchNumber,
          matchLevel: resolvedMatchLevel,
          organizationId: selectedOrganization.id,
        })
        .onConflictDoNothing()
        .run();

      const [row] = await db
        .select()
        .from(schema.matchData2025)
        .where(
          and(
            eq(schema.matchData2025.eventKey, normalizedEventKey),
            eq(schema.matchData2025.teamNumber, parsedTeamNumber),
            eq(schema.matchData2025.matchNumber, parsedMatchNumber),
            eq(schema.matchData2025.matchLevel, resolvedMatchLevel)
          )
        )
        .limit(1);

      if (!row) {
        throw new Error('Failed to retrieve submitted match data.');
      }

      const driverStationSlot = parseDriverStationSlot({
        driverStationLabel,
        allianceColor,
        stationPosition,
      });

      let nextMatchParams: Record<string, string> | null = null;

      if (driverStationSlot) {
        const scheduleRows = await db
          .select()
          .from(schema.matchSchedules)
          .where(eq(schema.matchSchedules.eventKey, normalizedEventKey));

        nextMatchParams = buildNextMatchParams(scheduleRows, {
          eventKey: normalizedEventKey,
          currentMatchLevel: resolvedMatchLevel,
          currentMatchNumber: parsedMatchNumber,
          driverStationSlot,
          driverStationLabel,
        });
      }

      const navigateToNextMatch = () => {
        if (nextMatchParams) {
          router.replace({ pathname: '/(drawer)/match-scout/begin-scouting', params: nextMatchParams });
        } else {
          router.replace('/(drawer)/match-scout');
        }
      };

      const showNextMatchAlert = (title: string, message: string) => {
        const buttonLabel = nextMatchParams ? 'Next Match' : 'OK';

        Alert.alert(
          title,
          message,
          [
            {
              text: buttonLabel,
              onPress: navigateToNextMatch,
            },
          ],
          { cancelable: false },
        );
      };

      try {
        const abortController = new AbortController();
        const timeoutId = setTimeout(() => abortController.abort(), 5000);

        try {
          await apiRequest('/scout/submit', {
            method: 'POST',
            body: JSON.stringify(row),
            signal: abortController.signal,
          });
        } finally {
          clearTimeout(timeoutId);
        }

        try {
          await syncAlreadyScoutedEntries(selectedOrganization.id);
        } catch (syncError) {
          console.error('Failed to refresh already scouted entries from API', syncError);
        }

        showNextMatchAlert('Match submitted', 'Match data was saved and sent successfully.');
      } catch (error) {
        console.error('Failed to submit match data to API', error);
        showNextMatchAlert(
          'Match saved locally',
          'The match data was saved on this device but could not be sent to the server.',
        );
      }
    } catch (error) {
      console.error('Failed to save match data', error);
      Alert.alert('Unable to save match', 'An error occurred while saving match data.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ScreenContainer>
      <View style={styles.content}>
        <View
          style={[
            styles.tabBar,
            { backgroundColor: toggleContainerBackground, borderColor: inputBorder },
          ]}
        >
          {tabOptions.map((tab) => {
            const isSelected = selectedTab === tab.key;

            return (
              <Pressable
                key={tab.key}
                accessibilityRole="button"
                onPress={() => setSelectedTab(tab.key)}
                style={({ pressed }) => [
                  styles.tabButton,
                  { backgroundColor: isSelected ? toggleActiveBackground : 'transparent' },
                  pressed && styles.buttonPressed,
                ]}
              >
                <ThemedText
                  type="defaultSemiBold"
                  style={[
                    styles.tabButtonText,
                    { color: isSelected ? toggleActiveTextColor : tabInactiveTextColor },
                  ]}
                >
                  {tab.label}
                </ThemedText>
              </Pressable>
            );
          })}
        </View>

        {selectedTab === 'info' ? (
          <View style={styles.infoSection}>
            <View style={[styles.infoCard, { borderColor: inputBorder, backgroundColor: inputBackground }]}>
              {infoDetails.map((detail) => (
                <View key={detail.label} style={styles.infoRow}>
                  <ThemedText type="defaultSemiBold">{detail.label}</ThemedText>
                  <ThemedText>{detail.value}</ThemedText>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        {isAutoTab || isTeleopTab ? (
          <View style={styles.scoringContent}>
            <View style={styles.detailsSection}>
              {!matchDetailsTitle && resolvedEventKey ? (
                <View style={styles.header}>
                  <ThemedText type="defaultSemiBold">Event: {resolvedEventKey}</ThemedText>
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
                      style={[
                        styles.input,
                        { backgroundColor: inputBackground, borderColor: inputBorder, color: textColor },
                      ]}
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
                      style={[
                        styles.input,
                        { backgroundColor: inputBackground, borderColor: inputBorder, color: textColor },
                      ]}
                    />
                  </View>
                </View>
              ) : null}
            </View>

            <View style={styles.section}>
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
                  {(isAutoTab || isTeleopTab) && (
                    <TabTransitionControl
                      incrementLabel={isAutoTab ? 'Teleop' : 'Endgame'}
                      decrementLabel={isAutoTab ? 'Info' : 'Auto'}
                      onIncrement={() => setSelectedTab(isAutoTab ? 'teleop' : 'endgame')}
                      onDecrement={() => setSelectedTab(isAutoTab ? 'info' : 'auto')}
                    />
                  )}
                </View>
              </View>
            </View>
          </View>
        ) : null}

        {selectedTab === 'endgame' ? (
          <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
            <View style={styles.endgameSection}>
              <View style={styles.endgameContent}>
                <ThemedText type="title" style={styles.sectionTitle}>
                  Endgame
                </ThemedText>
                <View style={styles.endgameGrid}>
                  {endgameOptions.map((option) => {
                    const isSelected = endgameSelection === option.key;

                    return (
                      <Pressable
                        key={option.key}
                        accessibilityRole="button"
                        onPress={() => setEndgameSelection(option.key)}
                        style={({ pressed }) => [
                          styles.endgameButton,
                          {
                            backgroundColor: isSelected ? toggleActiveBackground : 'transparent',
                            borderColor: isSelected ? toggleActiveBackground : inputBorder,
                          },
                          pressed && styles.buttonPressed,
                        ]}
                      >
                        <ThemedText
                          type="defaultSemiBold"
                          style={[
                            styles.endgameButtonText,
                            { color: isSelected ? toggleActiveTextColor : tabInactiveTextColor },
                          ]}
                        >
                          {option.label}
                        </ThemedText>
                      </Pressable>
                    );
                  })}
                </View>
                <View style={styles.generalNotesSection}>
                  <ThemedText type="defaultSemiBold" style={styles.generalNotesLabel}>
                    General Notes
                  </ThemedText>
                  <TextInput
                    multiline
                    numberOfLines={4}
                    placeholder="Add any observations or notes about the match"
                    placeholderTextColor="#94A3B8"
                    value={generalNotes}
                    onChangeText={setGeneralNotes}
                    onBlur={() => Keyboard.dismiss()}
                    style={[
                      styles.generalNotesInput,
                      {
                        backgroundColor: inputBackground,
                        borderColor: inputBorder,
                        color: textColor,
                      },
                    ]}
                    textAlignVertical="top"
                  />
                </View>
              </View>
              <Pressable
                accessibilityRole="button"
                disabled={isSubmitting}
                onPress={handleSubmit}
                style={({ pressed }) => [
                  styles.submitButton,
                  (pressed || isSubmitting) && styles.buttonPressed,
                  isSubmitting && styles.submitButtonDisabled,
                ]}
              >
                <ThemedText type="defaultSemiBold" style={styles.submitButtonText}>
                  {isSubmitting ? 'Submitting…' : 'Submit Match'}
                </ThemedText>
              </Pressable>
            </View>
          </TouchableWithoutFeedback>
        ) : null}
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    gap: 24,
  },
  scoringContent: {
    flex: 1,
    gap: 24,
  },
  tabBar: {
    flexDirection: 'row',
    borderRadius: 999,
    borderWidth: 1,
    overflow: 'hidden',
    alignSelf: 'center',
  },
  tabButton: {
    paddingVertical: 10,
    paddingHorizontal: 24,
  },
  tabButtonText: {
    fontSize: 16,
  },
  detailsSection: {
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
  phaseLabelContainer: {
    alignItems: 'center',
    marginTop: 8,
  },
  phaseLabel: {
    fontSize: 16,
  },
  section: {
    flex: 1,
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
    flex: 1,
    alignItems: 'stretch',
  },
  counterColumn: {
    flex: 1,
    gap: 16,
  },
  counterControl: {
    gap: 12,
    alignItems: 'stretch',
    minWidth: 150,
    flex: 1,
  },
  tabTransitionControl: {
    flex: 2,
    minHeight: 160,
  },
  counterLabel: {
    fontSize: 14,
    textAlign: 'center',
    color: '#E2E8F0',
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
    flex: 1,
  },
  counterButton: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
  },
  counterButtonPositive: {
    flex: 3,
    gap: 8,
  },
  counterButtonNegative: {
    flex: 1,
  },
  tabTransitionBackButton: {
    borderWidth: 1,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  counterButtonText: {
    color: '#F8FAFC',
    fontSize: 20,
  },
  counterButtonAuxText: {
    color: '#E2E8F0',
    fontSize: 18,
  },
  buttonPressed: {
    opacity: 0.85,
  },
  infoSection: {
    gap: 16,
  },
  infoCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    gap: 12,
  },
  infoRow: {
    gap: 4,
  },
  infoDescription: {
    textAlign: 'center',
  },
  endgameSection: {
    gap: 16,
    flex: 1,
  },
  endgameContent: {
    gap: 16,
    flex: 1,
  },
  endgameGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'space-between',
  },
  endgameButton: {
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 24,
    width: '48%',
    alignItems: 'center',
    flexGrow: 1,
  },
  endgameButtonText: {
    fontSize: 16,
  },
  generalNotesSection: {
    gap: 8,
  },
  generalNotesLabel: {
    fontSize: 16,
  },
  generalNotesInput: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    fontSize: 16,
    minHeight: 120,
  },
  submitButton: {
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: '#2563EB',
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: '#F8FAFC',
    fontSize: 18,
  },
  tabTransitionHeading: {
    color: '#E2E8F0',
    fontSize: 14,
  },
  tabTransitionLabel: {
    color: '#F8FAFC',
    fontSize: 24,
    textAlign: 'center',
  },
  tabTransitionBackLabel: {
    fontSize: 16,
    textAlign: 'center',
  },
});
