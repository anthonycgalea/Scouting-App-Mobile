import Ionicons from '@expo/vector-icons/Ionicons';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

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

const teamNumberKeys: (keyof RowData)[] = ['red1', 'red2', 'red3', 'blue1', 'blue2', 'blue3'];

const createMatchKey = (matchLevel: string, matchNumber: number) =>
  `${matchLevel.toLowerCase()}-${matchNumber}`;

const createRowData = (
  matches: MatchScheduleEntry[],
  playedMatches?: Set<string>,
  isValidationReady?: boolean
): RowData[] =>
  matches.map((match) => {
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

function filterData(
  data: RowData[],
  { matchSearch, teamSearch }: { matchSearch: string; teamSearch: string }
) {
  const matchQuery = matchSearch.trim();
  const matchNumberQuery = Number(matchQuery);
  const teamQuery = teamSearch.toLowerCase().trim();

  return data.filter((item) => {
    const matchMatches = matchQuery
      ? !Number.isNaN(matchNumberQuery) && item.matchNumber === matchNumberQuery
      : true;

    const teamMatches = teamQuery
      ? teamNumberKeys.some((key) => {
          const teamNumber = item[key];
          if (teamNumber === null || teamNumber === undefined) {
            return false;
          }

          return teamNumber.toString().toLowerCase() === teamQuery;
        })
      : true;

    return matchMatches && teamMatches;
  });
}

function sortData(
  data: RowData[],
  payload: { reversed: boolean; matchSearch: string; teamSearch: string }
) {
  const sorted = [...data].sort((a, b) =>
    payload.reversed ? b.matchNumber - a.matchNumber : a.matchNumber - b.matchNumber
  );

  return filterData(sorted, { matchSearch: payload.matchSearch, teamSearch: payload.teamSearch });
}

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
  const [matchSearch, setMatchSearch] = useState('');
  const [teamSearch, setTeamSearch] = useState('');
  const [reverseSortDirection, setReverseSortDirection] = useState(false);

  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const textColor = useThemeColor({}, 'text');
  const iconColor = useThemeColor({}, 'icon');

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

  const sortedData = useMemo(
    () => sortData(schedule, { reversed: reverseSortDirection, matchSearch, teamSearch }),
    [schedule, reverseSortDirection, matchSearch, teamSearch]
  );

  const toggleSortDirection = () => {
    setReverseSortDirection((current) => !current);
  };

  const placeholderColor = isDark ? 'rgba(148, 163, 184, 0.9)' : 'rgba(100, 116, 139, 0.9)';
  const inputBorderColor = isDark ? 'rgba(63, 63, 70, 0.8)' : 'rgba(209, 213, 219, 0.9)';
  const inputBackground = isDark ? 'rgba(39, 39, 42, 0.7)' : '#F9FAFB';
  const dividerColor = isDark ? 'rgba(63, 63, 70, 0.6)' : 'rgba(226, 232, 240, 0.9)';
  const cardBackground = isDark ? 'rgba(24, 24, 27, 0.85)' : '#FFFFFF';
  const headerTextColor = isDark ? '#F8FAFC' : '#0F172A';
  const redCellBackground = isDark ? 'rgba(127, 29, 29, 0.7)' : '#B91C1C';
  const blueCellBackground = isDark ? 'rgba(30, 64, 175, 0.7)' : '#1D4ED8';
  const redCellText = '#F8FAFC';
  const blueCellText = '#F8FAFC';
  const pendingTextColor = isDark ? 'rgba(156, 163, 175, 0.8)' : 'rgba(107, 114, 128, 0.9)';

  const rows = sortedData.map((row) => {
    const matchLabel = `${getMatchLevelLabel(row.matchLevel)} ${row.matchNumber}`;

    return (
      <View
        key={`${row.matchLevel}-${row.matchNumber}`}
        style={[styles.matchCard, { backgroundColor: cardBackground, borderColor: dividerColor }]}
      >
        <View style={styles.matchCardHeader}>
          <ThemedText type="defaultSemiBold" style={[styles.matchLabel, { color: headerTextColor }]}>
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
        <View style={[styles.allianceRow, { backgroundColor: redCellBackground }]}>
          <ThemedText style={[styles.allianceLabel, { color: redCellText }]}>Red</ThemedText>
          <View style={styles.teamList}>
            <ThemedText style={[styles.teamNumber, { color: redCellText }]}>
              {renderTeamNumber(row.red1)}
            </ThemedText>
            <ThemedText style={[styles.teamNumber, { color: redCellText }]}>
              {renderTeamNumber(row.red2)}
            </ThemedText>
            <ThemedText style={[styles.teamNumber, { color: redCellText }]}>
              {renderTeamNumber(row.red3)}
            </ThemedText>
          </View>
        </View>
        <View style={[styles.allianceRow, { backgroundColor: blueCellBackground }]}>
          <ThemedText style={[styles.allianceLabel, { color: blueCellText }]}>Blue</ThemedText>
          <View style={styles.teamList}>
            <ThemedText style={[styles.teamNumber, { color: blueCellText }]}>
              {renderTeamNumber(row.blue1)}
            </ThemedText>
            <ThemedText style={[styles.teamNumber, { color: blueCellText }]}>
              {renderTeamNumber(row.blue2)}
            </ThemedText>
            <ThemedText style={[styles.teamNumber, { color: blueCellText }]}>
              {renderTeamNumber(row.blue3)}
            </ThemedText>
          </View>
        </View>
      </View>
    );
  });

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.filters}>
        <View style={[styles.inputWrapper, { borderColor: inputBorderColor, backgroundColor: inputBackground }]}> 
          <Ionicons name="search" size={16} color={iconColor} style={styles.inputIcon} />
          <TextInput
            placeholder="Filter by match number"
            placeholderTextColor={placeholderColor}
            value={matchSearch}
            onChangeText={setMatchSearch}
            style={[styles.input, { color: textColor }]}
            keyboardType="numeric"
          />
        </View>
        <View style={[styles.inputWrapper, { borderColor: inputBorderColor, backgroundColor: inputBackground }]}> 
          <Ionicons name="search" size={16} color={iconColor} style={styles.inputIcon} />
          <TextInput
            placeholder="Filter by team number"
            placeholderTextColor={placeholderColor}
            value={teamSearch}
            onChangeText={setTeamSearch}
            style={[styles.input, { color: textColor }]}
            keyboardType="numeric"
          />
        </View>
      </View>
      <View style={styles.sortControl}>
        <PressableSortButton
          label="Match #"
          iconColor={headerTextColor}
          isReversed={reverseSortDirection}
          onPress={toggleSortDirection}
        />
      </View>
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

interface PressableSortButtonProps {
  label: string;
  iconColor: string;
  isReversed: boolean;
  onPress: () => void;
}

function PressableSortButton({ label, iconColor, isReversed, onPress }: PressableSortButtonProps) {
  return (
    <View style={styles.sortButtonContainer}>
      <Pressable
        style={({ pressed }) => [styles.sortButton, pressed && styles.sortButtonPressed]}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`Sort by ${label}`}
      >
        <ThemedText style={[styles.sortButtonLabel, { color: iconColor }]}>{label}</ThemedText>
        <Ionicons name={isReversed ? 'chevron-down' : 'chevron-up'} size={16} color={iconColor} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 16,
    paddingBottom: 24,
  },
  filters: {
    gap: 12,
  },
  inputWrapper: {
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  inputIcon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    paddingVertical: 10,
    fontSize: 16,
  },
  sortControl: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  sortButtonContainer: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  sortButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  sortButtonPressed: {
    opacity: 0.85,
  },
  sortButtonLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  matchList: {
    gap: 12,
  },
  matchCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    gap: 12,
  },
  matchCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  matchLabel: {
    fontSize: 18,
  },
  matchStatusWrapper: {
    alignItems: 'flex-end',
  },
  statusIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusText: {
    fontSize: 14,
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
  allianceRow: {
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  allianceLabel: {
    fontSize: 16,
    fontWeight: '700',
  },
  teamList: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  teamNumber: {
    fontSize: 18,
    fontWeight: '700',
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
