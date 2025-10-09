import Ionicons from '@expo/vector-icons/Ionicons';
import { useMemo } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useThemeColor } from '@/hooks/use-theme-color';

import type { MatchScheduleEntry, TeamMatchValidationEntry } from './types';

interface RowData {
  matchNumber: number;
  matchLevel: string;
  red1?: number | null;
  red2?: number | null;
  red3?: number | null;
  blue1?: number | null;
  blue2?: number | null;
  blue3?: number | null;
  played?: boolean;
}

interface MatchScheduleProps {
  matches: MatchScheduleEntry[];
  validationEntries?: TeamMatchValidationEntry[];
  isValidationLoading?: boolean;
  isValidationError?: boolean;
}

const createMatchKey = (matchLevel: string, matchNumber: number) =>
  `${matchLevel.toLowerCase()}-${matchNumber}`;

const createRowData = (
  matches: MatchScheduleEntry[],
  playedMatches?: Set<string>,
  isValidationReady?: boolean
): RowData[] =>
  [...matches]
    .sort((a, b) => a.match_number - b.match_number)
    .map((match) => {
      const matchKey = createMatchKey(match.match_level, match.match_number);

      return {
        matchNumber: match.match_number,
        matchLevel: match.match_level,
        red1: match.red1_id,
        red2: match.red2_id,
        red3: match.red3_id,
        blue1: match.blue1_id,
        blue2: match.blue2_id,
        blue3: match.blue3_id,
        played: isValidationReady ? playedMatches?.has(matchKey) ?? false : undefined,
      };
    });

const renderTeamNumber = (value?: number | null) => (value === null || value === undefined ? '-' : value);

const getMatchLevelLabel = (matchLevel: string) => {
  const normalized = matchLevel?.toLowerCase();

  if (normalized === 'qm') {
    return 'Quals';
  }

  if (normalized === 'sf') {
    return 'Semis';
  }

  if (normalized === 'qf') {
    return 'Quarters';
  }

  if (normalized === 'f') {
    return 'Finals';
  }

  return matchLevel.toUpperCase();
};

export function MatchSchedule({
  matches,
  validationEntries,
  isValidationError = false,
  isValidationLoading = false,
}: MatchScheduleProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const textColor = useThemeColor({}, 'text');

  const isValidationReady =
    !isValidationLoading && !isValidationError && validationEntries !== undefined;

  const playedMatches = useMemo(() => {
    if (!isValidationReady || !validationEntries) {
      return undefined;
    }

    const played = new Set<string>();
    validationEntries.forEach((entry) => {
      played.add(createMatchKey(entry.match_level, entry.match_number));
    });

    return played;
  }, [validationEntries, isValidationReady]);

  const schedule = useMemo(
    () => createRowData(matches, playedMatches, isValidationReady),
    [matches, playedMatches, isValidationReady]
  );

  const dividerColor = isDark ? 'rgba(63, 63, 70, 0.6)' : 'rgba(226, 232, 240, 0.9)';
  const cardBackground = isDark ? 'rgba(24, 24, 27, 0.85)' : '#FFFFFF';
  const headerTextColor = isDark ? '#F8FAFC' : '#0F172A';
  const redCellBackground = isDark ? 'rgba(127, 29, 29, 0.7)' : '#B91C1C';
  const blueCellBackground = isDark ? 'rgba(30, 64, 175, 0.7)' : '#1D4ED8';
  const redCellText = '#F8FAFC';
  const blueCellText = '#F8FAFC';
  const pendingTextColor = isDark ? 'rgba(156, 163, 175, 0.8)' : 'rgba(107, 114, 128, 0.9)';

  const rows = schedule.map((row) => {
    const matchLabel = `${getMatchLevelLabel(row.matchLevel)} ${row.matchNumber}`;
    const redTeams = [row.red1, row.red2, row.red3];
    const blueTeams = [row.blue1, row.blue2, row.blue3];

    return (
      <View
        key={`${row.matchLevel}-${row.matchNumber}`}
        style={[styles.matchCard, { backgroundColor: cardBackground, borderColor: dividerColor }]}
      >
        <View style={styles.matchLayout}>
          <View
            style={[styles.matchLabelCell, { borderColor: dividerColor, backgroundColor: cardBackground }]}
          >
            <ThemedText type="title" style={[styles.matchLabelText, { color: headerTextColor }]}>
              {matchLabel}
            </ThemedText>
            <View style={styles.matchStatusWrapper}>
              {row.played === undefined ? (
                <ThemedText style={[styles.statusText, { color: pendingTextColor }]}>Pending</ThemedText>
              ) : row.played ? (
                <View style={styles.statusIndicator}>
                  <Ionicons name="checkmark-circle" size={20} color="#22c55e" />
                  <ThemedText style={styles.statusSuccess}>Played</ThemedText>
                </View>
              ) : (
                <View style={styles.statusIndicator}>
                  <Ionicons name="close-circle" size={20} color="#ef4444" />
                  <ThemedText style={styles.statusError}>Unplayed</ThemedText>
                </View>
              )}
            </View>
          </View>
          <View style={styles.allianceGrid}>
            <View style={styles.allianceGridRow}>
              {redTeams.map((team, index) => (
                <View
                  key={`red-${index}`}
                  style={[styles.teamCell, { backgroundColor: redCellBackground }]}
                >
                  <ThemedText style={[styles.teamNumber, { color: redCellText }]}>
                    {renderTeamNumber(team)}
                  </ThemedText>
                </View>
              ))}
            </View>
            <View style={styles.allianceGridRow}>
              {blueTeams.map((team, index) => (
                <View
                  key={`blue-${index}`}
                  style={[styles.teamCell, { backgroundColor: blueCellBackground }]}
                >
                  <ThemedText style={[styles.teamNumber, { color: blueCellText }]}>
                    {renderTeamNumber(team)}
                  </ThemedText>
                </View>
              ))}
            </View>
          </View>
        </View>
      </View>
    );
  });

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {rows.length > 0 ? (
        <View style={styles.matchList}>{rows}</View>
      ) : (
        <View style={[styles.emptyState, { borderColor: dividerColor }]}>
          <ThemedText type="defaultSemiBold" style={[styles.emptyStateText, { color: textColor }]}>
            Nothing found
          </ThemedText>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 16,
    paddingBottom: 24,
  },
  matchList: {
    gap: 12,
  },
  matchCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
  },
  matchLayout: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 12,
  },
  allianceGrid: {
    flex: 1,
    gap: 12,
  },
  allianceGridRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 12,
  },
  matchLabelCell: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    justifyContent: 'space-between',
    gap: 8,
    alignItems: 'flex-start',
    alignSelf: 'stretch',
  },
  matchLabelText: {
    fontSize: 20,
    fontWeight: '700',
  },
  matchStatusWrapper: {
    alignItems: 'flex-start',
    gap: 8,
  },
  statusIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusText: {
    fontSize: 16,
    fontWeight: '600',
  },
  statusSuccess: {
    fontSize: 14,
    fontWeight: '600',
    color: '#22c55e',
  },
  statusError: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ef4444',
  },
  teamNumber: {
    fontSize: 18,
    fontWeight: '700',
  },
  teamCell: {
    flex: 1,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  emptyState: {
    paddingVertical: 32,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    borderWidth: 1,
  },
  emptyStateText: {
    textAlign: 'center',
  },
});
