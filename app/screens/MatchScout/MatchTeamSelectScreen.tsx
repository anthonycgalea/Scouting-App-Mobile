import { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';

import { ScreenContainer } from '@/components/layout/ScreenContainer';
import { ThemedText } from '@/components/themed-text';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useRouter } from 'expo-router';

import type { MatchScheduleEntry } from '@/components/match-schedule';

type TeamAlliance = 'red' | 'blue';

interface TeamOption {
  key: keyof Pick<MatchScheduleEntry, 'red1_id' | 'red2_id' | 'red3_id' | 'blue1_id' | 'blue2_id' | 'blue3_id'>;
  label: string;
  alliance: TeamAlliance;
  teamNumber?: number;
}

const toSingleValue = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value;

const parseNumberParam = (value: string | string[] | undefined) => {
  const raw = toSingleValue(value);
  if (!raw) {
    return undefined;
  }

  const parsed = Number(raw);

  return Number.isFinite(parsed) ? parsed : undefined;
};

const getMatchLevelLabel = (matchLevel: string | undefined) => {
  const normalized = matchLevel?.toLowerCase();

  switch (normalized) {
    case 'qm':
      return 'Quals';
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

const renderTeamNumber = (value?: number) => (value === undefined ? 'TBD' : value);

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

export interface MatchTeamSelectScreenProps {
  matchLevel?: string;
  matchNumber?: number;
  eventKey?: string;
  red1?: number;
  red2?: number;
  red3?: number;
  blue1?: number;
  blue2?: number;
  blue3?: number;
  onCancel: () => void;
}

export function MatchTeamSelectScreen({
  matchLevel,
  matchNumber,
  eventKey,
  red1,
  red2,
  red3,
  blue1,
  blue2,
  blue3,
  onCancel,
}: MatchTeamSelectScreenProps) {
  const [selectedTeam, setSelectedTeam] = useState<string>();
  const router = useRouter();
  const { height } = useWindowDimensions();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const cardBackground = useThemeColor({ light: '#F8FAFC', dark: '#1F2937' }, 'background');
  const borderColor = isDark ? 'rgba(148, 163, 184, 0.35)' : 'rgba(30, 41, 59, 0.2)';
  const redCellBackground = isDark ? 'rgba(127, 29, 29, 0.9)' : '#B91C1C';
  const blueCellBackground = isDark ? 'rgba(30, 64, 175, 0.85)' : '#1D4ED8';
  const neutralButtonBackground = useThemeColor({ light: '#E2E8F0', dark: '#27272A' }, 'background');
  const neutralButtonText = useThemeColor({}, 'text');
  const headerText = useThemeColor({}, 'text');
  const primaryButtonBackground = useThemeColor({ light: '#2563EB', dark: '#1E3A8A' }, 'tint');
  const redButtonBackground = useThemeColor({ light: '#DC2626', dark: '#7F1D1D' }, 'tint');
  const primaryButtonText = '#F8FAFC';

  const matchLabel = useMemo(() => {
    const levelLabel = getMatchLevelLabel(matchLevel);
    if (!levelLabel) {
      return matchNumber ? `Match ${matchNumber}` : 'Match Details';
    }

    if (!matchNumber) {
      return levelLabel;
    }

    return `${levelLabel} ${matchNumber}`;
  }, [matchLevel, matchNumber]);

  const teamOptions: TeamOption[] = useMemo(
    () => [
      { key: 'red1_id', label: 'Red 1', alliance: 'red', teamNumber: red1 },
      { key: 'red2_id', label: 'Red 2', alliance: 'red', teamNumber: red2 },
      { key: 'red3_id', label: 'Red 3', alliance: 'red', teamNumber: red3 },
      { key: 'blue1_id', label: 'Blue 1', alliance: 'blue', teamNumber: blue1 },
      { key: 'blue2_id', label: 'Blue 2', alliance: 'blue', teamNumber: blue2 },
      { key: 'blue3_id', label: 'Blue 3', alliance: 'blue', teamNumber: blue3 },
    ],
    [red1, red2, red3, blue1, blue2, blue3]
  );

  const selectedOption = useMemo(
    () => teamOptions.find((option) => option.key === selectedTeam),
    [selectedTeam, teamOptions]
  );

  const driverStationLabel = selectedOption?.label;

  const handleBeginScouting = useCallback(() => {
    if (!selectedOption || selectedOption.teamNumber === undefined) {
      return;
    }

    const params: Record<string, string> = {
      teamNumber: String(selectedOption.teamNumber),
    };

    const allianceColorValue = selectedOption.alliance;
    params.allianceColor = allianceColorValue;
    params.alliance_color = allianceColorValue;

    const stationPositionMatch = selectedOption.key.match(/(\d)/);

    if (stationPositionMatch) {
      const position = stationPositionMatch[1];
      params.stationPosition = position;
      params.station_position = position;
      params.driverStationPosition = position;
      params.driver_station_position = position;
    }

    if (driverStationLabel) {
      params.driverStation = driverStationLabel;
      params.driver_station = driverStationLabel;
    }

    if (matchNumber !== undefined) {
      params.matchNumber = String(matchNumber);
      params.match_number = String(matchNumber);
    }

    if (eventKey) {
      params.eventKey = eventKey;
      params.event_key = eventKey;
    }

    if (matchLevel) {
      params.matchLevel = matchLevel;
      params.match_level = matchLevel;
    }

    router.push({ pathname: '/(drawer)/match-scout/begin-scouting', params });
  }, [driverStationLabel, eventKey, matchLevel, matchNumber, router, selectedOption]);

  const canBeginScouting = selectedOption?.teamNumber !== undefined;

  const sizing = useMemo(() => {
    const verticalPadding = clamp(height * 0.025, 10, 20);
    const horizontalPadding = clamp(height * 0.018, 10, 20);
    const itemGap = clamp(height * 0.015, 8, 20);
    const teamNumberFontSize = clamp(height * 0.028, 18, 24);

    return {
      verticalPadding,
      horizontalPadding,
      itemGap,
      teamNumberFontSize,
    };
  }, [height]);

  return (
    <ScreenContainer>
      <View style={styles.header}>
        <ThemedText type="title" style={[styles.headerText, { color: headerText }]}> 
          Select an Alliance Position
        </ThemedText>
        <ThemedText style={[styles.subHeaderText, { color: headerText }]}>{matchLabel}</ThemedText>
      </View>
      <View style={[styles.optionsGrid, { gap: sizing.itemGap, paddingVertical: sizing.itemGap / 2 }]}> 
        {teamOptions.map((option) => {
          const backgroundColor = option.alliance === 'red' ? redCellBackground : blueCellBackground;
          const isSelected = selectedTeam === option.key;

          return (
            <Pressable
              key={option.key}
              onPress={() => setSelectedTeam(option.key)}
              style={({ pressed }) => [
                styles.teamOption,
                {
                  backgroundColor,
                  borderColor: isSelected ? '#FACC15' : borderColor,
                  paddingVertical: sizing.verticalPadding,
                  paddingHorizontal: sizing.horizontalPadding,
                  opacity: pressed ? 0.9 : 1,
                },
              ]}
            >
              <ThemedText type="defaultSemiBold" style={styles.teamLabel}>
                {option.label}: {renderTeamNumber(option.teamNumber)}
              </ThemedText>
            </Pressable>
          );
        })}
      </View>
      <View style={styles.footer}>
        <View style={[styles.selectionPreview, { backgroundColor: cardBackground, borderColor }]}>
          {selectedOption ? (
            <Pressable
              accessibilityRole="button"
              disabled={!canBeginScouting}
              onPress={handleBeginScouting}
              style={({ pressed }) => [
                styles.beginButton,
                {
                  backgroundColor:
                    selectedOption?.alliance === 'red'
                      ? redButtonBackground
                      : primaryButtonBackground,
                  opacity: !canBeginScouting ? 0.5 : pressed ? 0.85 : 1,
                },
              ]}
            >
              <ThemedText style={[styles.beginButtonText, { color: primaryButtonText }]}>
                {`Begin Scouting: ${renderTeamNumber(selectedOption.teamNumber)} (${driverStationLabel ?? ''})`}
              </ThemedText>
            </Pressable>
          ) : (
            <ThemedText style={[styles.selectionText, { color: headerText }]}>Select a team to continue</ThemedText>
          )}
        </View>
        <Pressable
          accessibilityRole="button"
          onPress={onCancel}
          style={({ pressed }) => [
            styles.cancelButton,
            {
              backgroundColor: neutralButtonBackground,
              opacity: pressed ? 0.85 : 1,
            },
          ]}
        >
          <ThemedText style={[styles.cancelButtonText, { color: neutralButtonText }]}>Cancel</ThemedText>
        </Pressable>
      </View>
    </ScreenContainer>
  );
}

export function createMatchTeamSelectScreenPropsFromParams(params: {
  matchLevel?: string | string[];
  matchNumber?: string | string[];
  eventKey?: string | string[];
  red1?: string | string[];
  red2?: string | string[];
  red3?: string | string[];
  blue1?: string | string[];
  blue2?: string | string[];
  blue3?: string | string[];
}) {
  return {
    matchLevel: toSingleValue(params.matchLevel),
    matchNumber: parseNumberParam(params.matchNumber),
    eventKey: toSingleValue(params.eventKey),
    red1: parseNumberParam(params.red1),
    red2: parseNumberParam(params.red2),
    red3: parseNumberParam(params.red3),
    blue1: parseNumberParam(params.blue1),
    blue2: parseNumberParam(params.blue2),
    blue3: parseNumberParam(params.blue3),
  };
}

const styles = StyleSheet.create({
  header: {
    gap: 4,
  },
  headerText: {
    textAlign: 'center',
  },
  subHeaderText: {
    textAlign: 'center',
    opacity: 0.8,
  },
  optionsGrid: {
    flex: 1,
    minHeight: 0,
    width: '100%',
    alignSelf: 'stretch',
    alignItems: 'stretch',
    justifyContent: 'center',
  },
  teamOption: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 0,
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
    borderRadius: 16,
    borderWidth: 2,
    gap: 8,
  },
  teamLabel: {
    color: '#F8FAFC',
  },
  teamNumber: {
    color: '#F8FAFC',
    fontSize: 20,
    fontWeight: '600',
  },
  footer: {
    gap: 12,
  },
  selectionPreview: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    gap: 8,
  },
  selectionText: {
    textAlign: 'center',
    fontWeight: '500',
  },
  beginButton: {
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  beginButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  cancelButton: {
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
