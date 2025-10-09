import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ScreenContainer } from '@/components/layout/ScreenContainer';
import { ThemedText } from '@/components/themed-text';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useThemeColor } from '@/hooks/use-theme-color';

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
      return 'Semis';
    case 'qf':
      return 'Quarters';
    case 'f':
      return 'Finals';
    default:
      return matchLevel?.toUpperCase() ?? '';
  }
};

const renderTeamNumber = (value?: number) => (value === undefined ? 'TBD' : value);

export interface MatchTeamSelectScreenProps {
  matchLevel?: string;
  matchNumber?: number;
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
  red1,
  red2,
  red3,
  blue1,
  blue2,
  blue3,
  onCancel,
}: MatchTeamSelectScreenProps) {
  const [selectedTeam, setSelectedTeam] = useState<string>();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const cardBackground = useThemeColor({ light: '#F8FAFC', dark: '#1F2937' }, 'background');
  const borderColor = isDark ? 'rgba(148, 163, 184, 0.35)' : 'rgba(30, 41, 59, 0.2)';
  const redCellBackground = isDark ? 'rgba(127, 29, 29, 0.9)' : '#B91C1C';
  const blueCellBackground = isDark ? 'rgba(30, 64, 175, 0.85)' : '#1D4ED8';
  const neutralButtonBackground = useThemeColor({ light: '#E2E8F0', dark: '#27272A' }, 'background');
  const neutralButtonText = useThemeColor({}, 'text');
  const headerText = useThemeColor({}, 'text');

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

  return (
    <ScreenContainer>
      <View style={styles.header}>
        <ThemedText type="title" style={[styles.headerText, { color: headerText }]}>
          Select an Alliance Position
        </ThemedText>
        <ThemedText style={[styles.subHeaderText, { color: headerText }]}>{matchLabel}</ThemedText>
      </View>
      <View style={styles.optionsGrid}>
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
                  opacity: pressed ? 0.9 : 1,
                },
              ]}
            >
              <ThemedText type="defaultSemiBold" style={styles.teamLabel}>
                {option.label}
              </ThemedText>
              <ThemedText type="default" style={styles.teamNumber}>
                {renderTeamNumber(option.teamNumber)}
              </ThemedText>
            </Pressable>
          );
        })}
      </View>
      <View style={styles.footer}>
        <View style={[styles.selectionPreview, { backgroundColor: cardBackground, borderColor }]}>          
          <ThemedText style={[styles.selectionText, { color: headerText }]}>
            {selectedTeam ? `Selected: ${teamOptions.find((option) => option.key === selectedTeam)?.label ?? ''}` : 'Select a team to continue'}
          </ThemedText>
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
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'space-between',
  },
  teamOption: {
    flexBasis: '48%',
    paddingVertical: 16,
    paddingHorizontal: 12,
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
  },
  selectionText: {
    textAlign: 'center',
    fontWeight: '500',
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
