import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { getActiveEvent } from '@/app/services/logged-in-event';
import { ScreenContainer } from '@/components/layout/ScreenContainer';
import {
  MatchSchedule,
  type MatchScheduleEntry,
  type MatchScheduleSection,
  MatchScheduleToggle,
  type MatchScheduleToggleOption,
  SECTION_DEFINITIONS,
  groupMatchesBySection,
} from '@/components/match-schedule';
import { ThemedText } from '@/components/themed-text';
import { getDbOrThrow, schema } from '@/db';
import type { MatchSchedule as MatchScheduleRow } from '@/db/schema';
import { useOrganization } from '@/hooks/use-organization';
import { useThemeColor } from '@/hooks/use-theme-color';
import { eq } from 'drizzle-orm';

const SECTION_ORDER: MatchScheduleSection[] = ['qualification', 'playoffs', 'finals'];

const MATCH_PREVIEW_SECTION_OPTIONS: MatchScheduleToggleOption[] = [
  ...SECTION_DEFINITIONS,
  { value: 'my-matches', label: 'My Matches' },
];

const mapScheduleRow = (row: MatchScheduleRow): MatchScheduleEntry => ({
  match_number: row.matchNumber,
  match_level: row.matchLevel,
  event_key: row.eventKey,
  red1_id: row.red1Id,
  red2_id: row.red2Id,
  red3_id: row.red3Id,
  blue1_id: row.blue1Id,
  blue2_id: row.blue2Id,
  blue3_id: row.blue3Id,
});

const MATCH_LEVEL_ORDER: Record<string, number> = {
  qm: 0,
  qf: 1,
  sf: 2,
  f: 3,
};

const MY_MATCH_LEVEL_ORDER: Record<string, number> = {
  qm: 0,
  sf: 1,
  f: 2,
  qf: 3,
};

const createMatchKey = (matchLevel?: string | null, matchNumber?: number | null) => {
  if (typeof matchLevel !== 'string' || typeof matchNumber !== 'number') {
    return null;
  }

  const normalizedLevel = matchLevel.toLowerCase();
  if (!normalizedLevel) {
    return null;
  }

  return `${normalizedLevel}-${matchNumber}`;
};

const buildMatchRouteParams = (match: MatchScheduleEntry) => {
  const params: Record<string, string> = {
    matchLevel: match.match_level,
    matchNumber: String(match.match_number),
  };

  const maybeAddTeam = (key: string, value: number | null | undefined) => {
    if (typeof value === 'number' && Number.isFinite(value)) {
      params[key] = String(value);
    }
  };

  if (match.event_key) {
    params.eventKey = match.event_key;
  }

  maybeAddTeam('red1', match.red1_id);
  maybeAddTeam('red2', match.red2_id);
  maybeAddTeam('red3', match.red3_id);
  maybeAddTeam('blue1', match.blue1_id);
  maybeAddTeam('blue2', match.blue2_id);
  maybeAddTeam('blue3', match.blue3_id);

  return params;
};

export function MatchPreviewsScreen() {
  const router = useRouter();
  const [selectedSection, setSelectedSection] = useState<MatchScheduleSection>('qualification');
  const [matches, setMatches] = useState<MatchScheduleEntry[]>([]);
  const [activeEventKey, setActiveEventKey] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [playedMatchKeys, setPlayedMatchKeys] = useState<Set<string>>(new Set());

  const { selectedOrganization } = useOrganization();

  const accentColor = useThemeColor({ light: '#2563EB', dark: '#1E3A8A' }, 'tint');
  const cardBackground = useThemeColor({ light: '#FFFFFF', dark: '#111827' }, 'background');
  const borderColor = useThemeColor({ light: 'rgba(15, 23, 42, 0.1)', dark: 'rgba(148, 163, 184, 0.25)' }, 'text');
  const textColor = useThemeColor({}, 'text');
  const mutedText = useThemeColor(
    { light: 'rgba(15, 23, 42, 0.7)', dark: 'rgba(226, 232, 240, 0.7)' },
    'text',
  );

  const loadSchedule = useCallback(() => {
    const eventKey = getActiveEvent();

    if (!eventKey) {
      throw new Error('No event is currently selected. Please select an event to view match previews.');
    }

    const db = getDbOrThrow();
    const rows = db
      .select()
      .from(schema.matchSchedules)
      .where(eq(schema.matchSchedules.eventKey, eventKey))
      .all();

    const playedRows = db
      .select({
        matchLevel: schema.matchData2025.matchLevel,
        matchNumber: schema.matchData2025.matchNumber,
      })
      .from(schema.matchData2025)
      .where(eq(schema.matchData2025.eventKey, eventKey))
      .all();

    const playedKeys = new Set<string>();
    playedRows.forEach((row) => {
      const key = createMatchKey(row.matchLevel, row.matchNumber);
      if (key) {
        playedKeys.add(key);
      }
    });

    const normalizedMatches = rows.map(mapScheduleRow).sort((a, b) => {
      const levelA = MATCH_LEVEL_ORDER[a.match_level?.toLowerCase() ?? ''] ?? Number.MAX_SAFE_INTEGER;
      const levelB = MATCH_LEVEL_ORDER[b.match_level?.toLowerCase() ?? ''] ?? Number.MAX_SAFE_INTEGER;

      if (levelA !== levelB) {
        return levelA - levelB;
      }

      return a.match_number - b.match_number;
    });

    return { eventKey, matches: normalizedMatches, playedMatchKeys: playedKeys };
  }, []);

  const applyScheduleResult = useCallback(
    (result: { eventKey: string; matches: MatchScheduleEntry[]; playedMatchKeys: Set<string> }) => {
      setActiveEventKey(result.eventKey);
      setMatches(result.matches);
      setPlayedMatchKeys(new Set(result.playedMatchKeys));
      setErrorMessage(null);
    },
    [],
  );

  const handleScheduleError = useCallback((error: unknown) => {
    const message =
      error instanceof Error
        ? error.message
        : 'An unexpected error occurred while loading the match schedule.';

    setErrorMessage(message);
    setMatches([]);
    setActiveEventKey(null);
    setPlayedMatchKeys(new Set());
  }, []);

  useFocusEffect(
    useCallback(() => {
      setIsLoading(true);

      try {
        const result = loadSchedule();
        applyScheduleResult(result);
      } catch (error) {
        handleScheduleError(error);
      } finally {
        setIsLoading(false);
      }

      return () => {};
    }, [applyScheduleResult, handleScheduleError, loadSchedule]),
  );

  const organizationTeamNumber =
    typeof selectedOrganization?.teamNumber === 'number' && Number.isFinite(selectedOrganization.teamNumber)
      ? selectedOrganization.teamNumber
      : null;

  const myMatches = useMemo(() => {
    if (organizationTeamNumber === null) {
      return [] as MatchScheduleEntry[];
    }

    const teamMatches = matches.filter((match) => {
      const alliances = [
        match.red1_id,
        match.red2_id,
        match.red3_id,
        match.blue1_id,
        match.blue2_id,
        match.blue3_id,
      ];

      return alliances.includes(organizationTeamNumber);
    });

    return teamMatches.sort((a, b) => {
      const keyA = createMatchKey(a.match_level, a.match_number);
      const keyB = createMatchKey(b.match_level, b.match_number);
      const isPlayedA = keyA ? playedMatchKeys.has(keyA) : false;
      const isPlayedB = keyB ? playedMatchKeys.has(keyB) : false;

      if (isPlayedA !== isPlayedB) {
        return isPlayedA ? 1 : -1;
      }

      const levelA = MY_MATCH_LEVEL_ORDER[a.match_level?.toLowerCase() ?? ''] ?? Number.MAX_SAFE_INTEGER;
      const levelB = MY_MATCH_LEVEL_ORDER[b.match_level?.toLowerCase() ?? ''] ?? Number.MAX_SAFE_INTEGER;

      if (levelA !== levelB) {
        return levelA - levelB;
      }

      return a.match_number - b.match_number;
    });
  }, [matches, organizationTeamNumber, playedMatchKeys]);

  const groupedMatches = useMemo(() => {
    const grouped = groupMatchesBySection(matches);
    return { ...grouped, 'my-matches': myMatches };
  }, [matches, myMatches]);

  const handleRefresh = useCallback(() => {
    if (isRefreshing) {
      return;
    }

    setIsRefreshing(true);

    try {
      const result = loadSchedule();
      applyScheduleResult(result);
    } catch (error) {
      handleScheduleError(error);
    } finally {
      setIsRefreshing(false);
    }
  }, [applyScheduleResult, handleScheduleError, isRefreshing, loadSchedule]);

  useEffect(() => {
    if (matches.length === 0) {
      if (selectedSection !== 'qualification') {
        setSelectedSection('qualification');
      }
      return;
    }

    const currentSectionMatches = groupedMatches[selectedSection];
    if (currentSectionMatches.length === 0) {
      const fallback = SECTION_ORDER.find((section) => groupedMatches[section].length > 0);
      if (fallback && fallback !== selectedSection) {
        setSelectedSection(fallback);
      }
    }
  }, [groupedMatches, matches.length, selectedSection]);

  const handleMatchPress = useCallback(
    (match: MatchScheduleEntry) => {
      const params = buildMatchRouteParams(match);
      router.push({ pathname: '/(drawer)/match-previews/view', params });
    },
    [router],
  );

  const hasMatches = matches.length > 0;
  const hasOrganizationTeam = organizationTeamNumber !== null;
  const selectedMatches = groupedMatches[selectedSection];
  const shouldShowOrganizationPrompt = selectedSection === 'my-matches' && !hasOrganizationTeam;

  return (
    <ScreenContainer>
      {isLoading ? (
        <View style={styles.stateWrapper}>
          <ActivityIndicator accessibilityLabel="Loading match schedule" color={accentColor} />
          <ThemedText style={[styles.stateMessage, { color: mutedText }]}>Loading match schedule…</ThemedText>
        </View>
      ) : hasMatches ? (
        <>
          <MatchScheduleToggle
            value={selectedSection}
            onChange={setSelectedSection}
            options={MATCH_PREVIEW_SECTION_OPTIONS}
          />
          {shouldShowOrganizationPrompt ? (
            <View style={[styles.stateCard, { backgroundColor: cardBackground, borderColor }]}>
              <ThemedText type="defaultSemiBold" style={[styles.stateTitle, { color: textColor }]}>
                Select an organization to view your matches
              </ThemedText>
              <ThemedText style={[styles.stateMessage, { color: mutedText }]}> 
                Choose an organization with a team number to filter matches assigned to your team.
              </ThemedText>
            </View>
          ) : (
            <MatchSchedule matches={selectedMatches} onMatchPress={handleMatchPress} />
          )}
        </>
      ) : (
        <View style={[styles.stateCard, { backgroundColor: cardBackground, borderColor }]}> 
          <ThemedText type="defaultSemiBold" style={[styles.stateTitle, { color: textColor }]}> 
            {errorMessage ? 'Unable to load match schedule' : 'No match schedule available'}
          </ThemedText>
          <ThemedText style={[styles.stateMessage, { color: mutedText }]}>
            {errorMessage
              ? errorMessage
              : activeEventKey
              ? 'No matches are available for the selected event yet.'
              : 'Select an event to load its match schedule.'}
          </ThemedText>
        </View>
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 16,
    marginBottom: 16,
  },
  headerTextContainer: {
    flex: 1,
    gap: 8,
  },
  refreshButton: {
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 140,
  },
  refreshButtonText: {
    color: '#F8FAFC',
    fontWeight: '600',
  },
  stateWrapper: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  stateCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 20,
    gap: 12,
  },
  stateTitle: {
    fontSize: 18,
  },
  stateMessage: {
    textAlign: 'center',
    fontSize: 16,
  },
});
