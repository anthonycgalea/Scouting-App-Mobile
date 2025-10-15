import Ionicons from '@expo/vector-icons/Ionicons';
import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useThemeColor } from '@/hooks/use-theme-color';

import type { MatchScheduleEntry, TeamMatchValidationEntry } from './types';

interface RowData {
  match: MatchScheduleEntry;
  matchNumber: number;
  matchLevel: string;
  redTeams: (number | null | undefined)[];
  blueTeams: (number | null | undefined)[];
  redScouted: boolean[];
  blueScouted: boolean[];
  isFullyScouted: boolean;
  played?: boolean;
}

interface MatchScheduleProps {
  matches: MatchScheduleEntry[];
  validationEntries?: TeamMatchValidationEntry[];
  isValidationLoading?: boolean;
  isValidationError?: boolean;
  onMatchPress?: (match: MatchScheduleEntry) => void;
  scoutedTeamMatches?: Set<string>;
}

const createMatchKey = (matchLevel: string, matchNumber: number) =>
  `${matchLevel.toLowerCase()}-${matchNumber}`;

const createTeamMatchKey = (matchLevel: string, matchNumber: number, teamNumber: number) =>
  `${matchLevel.toLowerCase()}-${matchNumber}-${teamNumber}`;

const createRowData = (
  matches: MatchScheduleEntry[],
  playedMatches?: Set<string>,
  isValidationReady?: boolean,
  scoutedTeamMatches?: Set<string>
): RowData[] =>
  [...matches]
    .sort((a, b) => a.match_number - b.match_number)
    .map((match) => {
      const matchKey = createMatchKey(match.match_level, match.match_number);
      const redTeams = [match.red1_id, match.red2_id, match.red3_id];
      const blueTeams = [match.blue1_id, match.blue2_id, match.blue3_id];

      const computeScouted = (teamNumber: number | null | undefined) => {
        if (typeof teamNumber !== 'number') {
          return false;
        }

        if (!scoutedTeamMatches) {
          return false;
        }

        return scoutedTeamMatches.has(
          createTeamMatchKey(match.match_level, match.match_number, teamNumber)
        );
      };

      const redScouted = redTeams.map(computeScouted);
      const blueScouted = blueTeams.map(computeScouted);

      const isFullyScouted = [...redScouted, ...blueScouted].every(Boolean);

      return {
        match,
        matchNumber: match.match_number,
        matchLevel: match.match_level,
        redTeams,
        blueTeams,
        redScouted,
        blueScouted,
        isFullyScouted,
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
  onMatchPress,
  scoutedTeamMatches,
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
    () => createRowData(matches, playedMatches, isValidationReady, scoutedTeamMatches),
    [matches, playedMatches, isValidationReady, scoutedTeamMatches]
  );

  const dividerColor = isDark ? 'rgba(63, 63, 70, 0.6)' : 'rgba(226, 232, 240, 0.9)';
  const cardBackground = isDark ? 'rgba(24, 24, 27, 0.85)' : '#FFFFFF';
  const headerTextColor = isDark ? '#F8FAFC' : '#0F172A';
  const redCellBackground = isDark ? 'rgba(127, 29, 29, 0.7)' : '#B91C1C';
  const blueCellBackground = isDark ? 'rgba(30, 64, 175, 0.7)' : '#1D4ED8';
  const redCellText = '#F8FAFC';
  const blueCellText = '#F8FAFC';
  const scoutedCellBackground = isDark ? 'rgba(63, 63, 70, 0.55)' : 'rgba(226, 232, 240, 0.85)';
  const scoutedCellText = isDark ? '#E5E7EB' : '#1F2937';
  const pendingTextColor = isDark ? 'rgba(156, 163, 175, 0.8)' : 'rgba(107, 114, 128, 0.9)';

  const activeRows = schedule.filter((row) => !row.isFullyScouted);
  const completedRows = schedule.filter((row) => row.isFullyScouted);

  const renderMatchRow = (row: RowData, useAllianceColors: boolean) => {
    const matchLabel = `${getMatchLevelLabel(row.matchLevel)} ${row.matchNumber}`;

    const renderAllianceRow = (
      teams: (number | null | undefined)[],
      scouted: boolean[],
      allianceColor: 'red' | 'blue'
    ) => {
      const baseBackground = allianceColor === 'red' ? redCellBackground : blueCellBackground;
      const baseTextColor = allianceColor === 'red' ? redCellText : blueCellText;

      return teams.map((team, index) => {
        const isScouted = scouted[index];
        const useGrey = isScouted && !useAllianceColors;
        const backgroundColor = useGrey ? scoutedCellBackground : baseBackground;
        const textColor = useGrey ? scoutedCellText : baseTextColor;

        return (
          <View key={`${allianceColor}-${index}`} style={[styles.teamCell, { backgroundColor }]}>
            <ThemedText style={[styles.teamNumber, { color: textColor }]}>
              {renderTeamNumber(team)}
            </ThemedText>
          </View>
        );
      });
    };

    return (
      <Pressable
        key={`${row.matchLevel}-${row.matchNumber}`}
        onPress={onMatchPress ? () => onMatchPress(row.match) : undefined}
        style={({ pressed }) => [
          styles.matchCard,
          {
            backgroundColor: cardBackground,
            borderColor: dividerColor,
            opacity: pressed ? 0.96 : 1,
          },
        ]}
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
              {renderAllianceRow(row.redTeams, row.redScouted, 'red')}
            </View>
            <View style={styles.allianceGridRow}>
              {renderAllianceRow(row.blueTeams, row.blueScouted, 'blue')}
            </View>
          </View>
        </View>
      </Pressable>
    );
  };

  const hasRows = schedule.length > 0;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {hasRows ? (
        <View style={styles.matchList}>
          {activeRows.map((row) => renderMatchRow(row, false))}
          {completedRows.length > 0 ? (
            <>
              <View style={styles.completedHeaderContainer}>
                <ThemedText
                  type="defaultSemiBold"
                  style={[styles.completedHeaderText, { color: headerTextColor }]}
                >
                  Already Scouted
                </ThemedText>
              </View>
              {completedRows.map((row) => renderMatchRow(row, true))}
            </>
          ) : null}
        </View>
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
    paddingHorizontal: 16,
    paddingVertical: 24,
    alignItems: 'center',
  },
  matchList: {
    width: '100%',
    gap: 16,
    alignItems: 'center',
  },
  matchCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    width: '100%',
    marginVertical: 8,
  },
  completedHeaderContainer: {
    width: '100%',
    paddingTop: 8,
    paddingBottom: 4,
  },
  completedHeaderText: {
    fontSize: 14,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  matchLayout: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 12,
  },
  allianceGrid: {
    flex: 3,
    gap: 12,
  },
  allianceGridRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 0,
  },
  matchLabelCell: {
    flex: 1,
    borderRadius: 0,
    borderWidth: 0,
    paddingVertical: 12,
    paddingHorizontal: 16,
    justifyContent: 'center',
    textAlign: 'center',
    gap: 8,
    alignItems: 'center',
    alignSelf: 'stretch',
  },
  matchLabelText: {
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
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
    borderRadius: 0,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 0,
    paddingHorizontal: 0,
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
