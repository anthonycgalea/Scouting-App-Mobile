import Ionicons from '@expo/vector-icons/Ionicons';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useThemeColor } from '@/hooks/use-theme-color';

import { MatchNumberButtonMenu } from './match-number-button-menu';
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
  const dividerColor = isDark ? 'rgba(63, 63, 70, 0.8)' : 'rgba(229, 231, 235, 0.9)';
  const headerBackground = isDark ? 'rgba(30, 41, 59, 0.8)' : 'rgba(226, 232, 240, 0.8)';
  const headerTextColor = isDark ? '#E2E8F0' : '#1E293B';
  const redCellBackground = isDark ? 'rgba(127, 29, 29, 0.6)' : '#FEE2E2';
  const redCellText = isDark ? '#FECACA' : '#7F1D1D';
  const blueCellBackground = isDark ? 'rgba(30, 64, 175, 0.6)' : '#DBEAFE';
  const blueCellText = isDark ? '#BFDBFE' : '#1E3A8A';
  const pendingTextColor = isDark ? 'rgba(156, 163, 175, 0.8)' : 'rgba(107, 114, 128, 0.9)';

  const rows = sortedData.map((row) => (
    <View key={`${row.matchLevel}-${row.matchNumber}`} style={[styles.row, { borderColor: dividerColor }]}>
      <View style={[styles.cell, styles.matchCell]}> 
        <MatchNumberButtonMenu matchNumber={row.matchNumber} matchLevel={row.matchLevel} />
      </View>
      <View style={[styles.cell, { backgroundColor: redCellBackground }]}> 
        <ThemedText style={[styles.cellText, { color: redCellText }]}> 
          {renderTeamNumber(row.red1)}
        </ThemedText>
      </View>
      <View style={[styles.cell, { backgroundColor: redCellBackground }]}> 
        <ThemedText style={[styles.cellText, { color: redCellText }]}> 
          {renderTeamNumber(row.red2)}
        </ThemedText>
      </View>
      <View style={[styles.cell, { backgroundColor: redCellBackground }]}> 
        <ThemedText style={[styles.cellText, { color: redCellText }]}> 
          {renderTeamNumber(row.red3)}
        </ThemedText>
      </View>
      <View style={[styles.cell, { backgroundColor: blueCellBackground }]}> 
        <ThemedText style={[styles.cellText, { color: blueCellText }]}> 
          {renderTeamNumber(row.blue1)}
        </ThemedText>
      </View>
      <View style={[styles.cell, { backgroundColor: blueCellBackground }]}> 
        <ThemedText style={[styles.cellText, { color: blueCellText }]}> 
          {renderTeamNumber(row.blue2)}
        </ThemedText>
      </View>
      <View style={[styles.cell, { backgroundColor: blueCellBackground }]}> 
        <ThemedText style={[styles.cellText, { color: blueCellText }]}> 
          {renderTeamNumber(row.blue3)}
        </ThemedText>
      </View>
      <View style={[styles.cell, styles.statusCell]}> 
        {row.played === undefined ? (
          <ThemedText style={[styles.statusText, { color: pendingTextColor }]}>N/A</ThemedText>
        ) : row.played ? (
          <Ionicons name="checkmark-circle" size={26} color="#22c55e" />
        ) : (
          <Ionicons name="close-circle" size={26} color="#ef4444" />
        )}
      </View>
    </View>
  ));

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
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={[styles.table, { borderColor: dividerColor }]}> 
          <View style={[styles.row, styles.headerRow, { backgroundColor: headerBackground, borderColor: dividerColor }]}> 
            <View style={[styles.cell, styles.headerCell, styles.matchCell]}> 
              <PressableSortButton
                label="Match #"
                iconColor={headerTextColor}
                isReversed={reverseSortDirection}
                onPress={toggleSortDirection}
              />
            </View>
            <View style={[styles.cell, styles.headerCell]}> 
              <ThemedText style={[styles.headerText, { color: headerTextColor }]}>Red 1</ThemedText>
            </View>
            <View style={[styles.cell, styles.headerCell]}> 
              <ThemedText style={[styles.headerText, { color: headerTextColor }]}>Red 2</ThemedText>
            </View>
            <View style={[styles.cell, styles.headerCell]}> 
              <ThemedText style={[styles.headerText, { color: headerTextColor }]}>Red 3</ThemedText>
            </View>
            <View style={[styles.cell, styles.headerCell]}> 
              <ThemedText style={[styles.headerText, { color: headerTextColor }]}>Blue 1</ThemedText>
            </View>
            <View style={[styles.cell, styles.headerCell]}> 
              <ThemedText style={[styles.headerText, { color: headerTextColor }]}>Blue 2</ThemedText>
            </View>
            <View style={[styles.cell, styles.headerCell]}> 
              <ThemedText style={[styles.headerText, { color: headerTextColor }]}>Blue 3</ThemedText>
            </View>
            <View style={[styles.cell, styles.headerCell, styles.statusCell]}> 
              <ThemedText style={[styles.headerText, { color: headerTextColor }]}>Played</ThemedText>
            </View>
          </View>
          {rows.length > 0 ? (
            rows
          ) : (
            <View style={[styles.emptyState, { borderColor: dividerColor }]}> 
              <ThemedText type="defaultSemiBold" style={[styles.emptyStateText, { color: textColor }]}> 
                Nothing found
              </ThemedText>
            </View>
          )}
        </View>
      </ScrollView>
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
        <ThemedText style={[styles.headerText, { color: iconColor }]}>{label}</ThemedText>
        <Ionicons
          name={isReversed ? 'chevron-down' : 'chevron-up'}
          size={16}
          color={iconColor}
        />
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
  table: {
    borderWidth: 1,
    borderRadius: 16,
    overflow: 'hidden',
    minWidth: 640,
  },
  row: {
    flexDirection: 'row',
    borderBottomWidth: 1,
  },
  headerRow: {
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  cell: {
    paddingVertical: 12,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 90,
  },
  matchCell: {
    minWidth: 130,
  },
  headerCell: {
    backgroundColor: 'transparent',
  },
  headerText: {
    fontSize: 14,
    fontWeight: '600',
  },
  cellText: {
    fontSize: 14,
    fontWeight: '500',
  },
  statusCell: {
    minWidth: 100,
  },
  statusText: {
    fontSize: 14,
  },
  sortButtonContainer: {
    width: '100%',
  },
  sortButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  sortButtonPressed: {
    opacity: 0.85,
  },
  emptyState: {
    paddingVertical: 32,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderTopWidth: 1,
  },
  emptyStateText: {
    textAlign: 'center',
  },
});
