import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { getActiveEvent } from '@/app/services/logged-in-event';
import {
  fetchMatchSchedule,
  type MatchScheduleEntry as ApiMatchScheduleEntry,
} from '@/app/services/api/match-previews';
import { ScreenContainer } from '@/components/layout/ScreenContainer';
import {
  MatchSchedule,
  type MatchScheduleEntry,
  type MatchScheduleSection,
  MatchScheduleToggle,
  SECTION_DEFINITIONS,
  groupMatchesBySection,
} from '@/components/match-schedule';
import { ThemedText } from '@/components/themed-text';
import { useThemeColor } from '@/hooks/use-theme-color';

const SECTION_ORDER: MatchScheduleSection[] = ['qualification', 'playoffs', 'finals'];

const mapScheduleEntry = (entry: ApiMatchScheduleEntry): MatchScheduleEntry => ({
  match_number: entry.match_number,
  match_level: entry.match_level,
  event_key: entry.event_key,
  red1_id: entry.red1_id ?? undefined,
  red2_id: entry.red2_id ?? undefined,
  red3_id: entry.red3_id ?? undefined,
  blue1_id: entry.blue1_id ?? undefined,
  blue2_id: entry.blue2_id ?? undefined,
  blue3_id: entry.blue3_id ?? undefined,
});

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

  const accentColor = useThemeColor({ light: '#2563EB', dark: '#1E3A8A' }, 'tint');
  const cardBackground = useThemeColor({ light: '#FFFFFF', dark: '#111827' }, 'background');
  const borderColor = useThemeColor({ light: 'rgba(15, 23, 42, 0.1)', dark: 'rgba(148, 163, 184, 0.25)' }, 'text');
  const textColor = useThemeColor({}, 'text');
  const mutedText = useThemeColor(
    { light: 'rgba(15, 23, 42, 0.7)', dark: 'rgba(226, 232, 240, 0.7)' },
    'text',
  );

  const loadSchedule = useCallback(async () => {
    const eventKey = getActiveEvent();

    if (!eventKey) {
      throw new Error('No event is currently selected. Please select an event to view match previews.');
    }

    const response = await fetchMatchSchedule({ eventKey });
    const normalizedMatches = (response ?? []).map(mapScheduleEntry);

    return { eventKey, matches: normalizedMatches };
  }, []);

  const applyScheduleResult = useCallback(
    (result: { eventKey: string; matches: MatchScheduleEntry[] }) => {
      setActiveEventKey(result.eventKey);
      setMatches(result.matches);
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
  }, []);

  useFocusEffect(
    useCallback(() => {
      let isActive = true;

      setIsLoading(true);

      loadSchedule()
        .then((result) => {
          if (!isActive) {
            return;
          }

          applyScheduleResult(result);
        })
        .catch((error) => {
          if (!isActive) {
            return;
          }

          handleScheduleError(error);
        })
        .finally(() => {
          if (isActive) {
            setIsLoading(false);
          }
        });

      return () => {
        isActive = false;
      };
    }, [applyScheduleResult, handleScheduleError, loadSchedule]),
  );

  const handleRefresh = useCallback(() => {
    if (isRefreshing) {
      return;
    }

    setIsRefreshing(true);

    loadSchedule()
      .then((result) => {
        applyScheduleResult(result);
      })
      .catch((error) => {
        handleScheduleError(error);
      })
      .finally(() => {
        setIsRefreshing(false);
      });
  }, [applyScheduleResult, handleScheduleError, isRefreshing, loadSchedule]);

  useEffect(() => {
    if (matches.length === 0) {
      if (selectedSection !== 'qualification') {
        setSelectedSection('qualification');
      }
      return;
    }

    const grouped = groupMatchesBySection(matches);
    if (grouped[selectedSection].length === 0) {
      const fallback = SECTION_ORDER.find((section) => grouped[section].length > 0);
      if (fallback && fallback !== selectedSection) {
        setSelectedSection(fallback);
      }
    }
  }, [matches, selectedSection]);

  const groupedMatches = useMemo(() => groupMatchesBySection(matches), [matches]);

  const handleMatchPress = useCallback(
    (match: MatchScheduleEntry) => {
      const params = buildMatchRouteParams(match);
      router.push({ pathname: '/(drawer)/match-previews/view', params });
    },
    [router],
  );

  const hasMatches = matches.length > 0;

  return (
    <ScreenContainer>
      <View style={styles.header}>
        <View style={styles.headerTextContainer}>
          <ThemedText type="title">Match Previews</ThemedText>
          <ThemedText type="subtitle">
            Browse the event match schedule and open a matchup to view its preview data.
          </ThemedText>
        </View>
        <Pressable
          accessibilityRole="button"
          onPress={handleRefresh}
          style={({ pressed }) => [
            styles.refreshButton,
            {
              backgroundColor: accentColor,
              opacity: pressed || isRefreshing ? 0.9 : 1,
            },
          ]}
        >
          {isRefreshing ? (
            <ActivityIndicator color="#F8FAFC" />
          ) : (
            <ThemedText style={styles.refreshButtonText}>Refresh schedule</ThemedText>
          )}
        </Pressable>
      </View>

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
            options={SECTION_DEFINITIONS}
          />
          <MatchSchedule matches={groupedMatches[selectedSection]} onMatchPress={handleMatchPress} />
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
