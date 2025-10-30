import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, View } from 'react-native';

import { retrieveEventInfo } from '@/app/services/event-info';
import { getActiveEvent } from '@/app/services/logged-in-event';
import { ScreenContainer } from '@/components/layout/ScreenContainer';
import {
  MatchSchedule,
  MatchScheduleEntry,
  MatchScheduleSection,
  MatchScheduleToggle,
  SECTION_DEFINITIONS,
  groupMatchesBySection,
} from '@/components/match-schedule';
import { ThemedText } from '@/components/themed-text';
import { getDbOrThrow, schema } from '@/db';
import type { MatchSchedule as MatchScheduleRow } from '@/db/schema';
import { useThemeColor } from '@/hooks/use-theme-color';
import { eq } from 'drizzle-orm';

const matchRowToEntry = (row: MatchScheduleRow): MatchScheduleEntry => ({
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

const SECTION_ORDER: MatchScheduleSection[] = ['qualification', 'playoffs', 'finals'];

export function SuperScoutScreen() {
  const router = useRouter();
  const [selectedSection, setSelectedSection] = useState<MatchScheduleSection>('qualification');
  const [matches, setMatches] = useState<MatchScheduleEntry[]>([]);
  const [activeEventKey, setActiveEventKey] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDownloading, setIsDownloading] = useState(false);

  const accentColor = useThemeColor({ light: '#2563EB', dark: '#1E3A8A' }, 'tint');
  const buttonTextColor = '#F8FAFC';
  const cardBackground = useThemeColor({ light: '#FFFFFF', dark: '#111827' }, 'background');
  const borderColor = useThemeColor({ light: 'rgba(15, 23, 42, 0.1)', dark: 'rgba(148, 163, 184, 0.25)' }, 'text');
  const textColor = useThemeColor({}, 'text');
  const mutedText = useThemeColor(
    { light: 'rgba(15, 23, 42, 0.7)', dark: 'rgba(226, 232, 240, 0.7)' },
    'text'
  );

  const loadMatchesFromDb = useCallback(() => {
    const eventKey = getActiveEvent();

    if (!eventKey) {
      throw new Error('No event is currently selected. Please select an event to view its match schedule.');
    }

    const db = getDbOrThrow();
    const rows = db
      .select()
      .from(schema.matchSchedules)
      .where(eq(schema.matchSchedules.eventKey, eventKey))
      .all();

    return { eventKey, matches: rows.map(matchRowToEntry) };
  }, []);

  useFocusEffect(
    useCallback(() => {
      setIsLoading(true);

      try {
        const { eventKey, matches: data } = loadMatchesFromDb();
        setActiveEventKey(eventKey);
        setMatches(data);
        setErrorMessage(null);
      } catch (error) {
        console.error('Failed to load match schedule', error);
        const message =
          error instanceof Error
            ? error.message
            : 'An unexpected error occurred while loading the match schedule.';
        setErrorMessage(message);
        setActiveEventKey(null);
        setMatches([]);
      } finally {
        setIsLoading(false);
      }

      return () => {};
    }, [loadMatchesFromDb])
  );

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

  const handleDownloadPress = useCallback(async () => {
    if (isDownloading) {
      return;
    }

    try {
      setIsDownloading(true);
      await retrieveEventInfo();
      const { eventKey, matches: data } = loadMatchesFromDb();
      setActiveEventKey(eventKey);
      setMatches(data);
      setErrorMessage(null);

      if (data.length === 0) {
        Alert.alert('No match schedule available', 'The event has not published a match schedule yet.');
      }
    } catch (error) {
      console.error('Failed to download match schedule', error);
      const message =
        error instanceof Error
          ? error.message
          : 'An unexpected error occurred while downloading the match schedule.';
      Alert.alert('Download failed', message);
    } finally {
      setIsDownloading(false);
    }
  }, [isDownloading, loadMatchesFromDb]);

  const handleMatchPress = useCallback(
    (match: MatchScheduleEntry) => {
      const params: Record<string, string> = {
        matchLevel: match.match_level,
        matchNumber: String(match.match_number),
      };

      const maybeAddTeam = (key: string, value: number | null | undefined) => {
        if (value !== null && value !== undefined) {
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

      router.push({ pathname: '/(drawer)/super-scout/select-alliance', params });
    },
    [router]
  );

  const hasMatches = matches.length > 0;

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
            options={SECTION_DEFINITIONS}
          />
          <MatchSchedule matches={groupedMatches[selectedSection]} onMatchPress={handleMatchPress} />
        </>
      ) : (
        <View style={[styles.stateCard, { backgroundColor: cardBackground, borderColor }]}>
          <ThemedText type="defaultSemiBold" style={[styles.stateTitle, { color: textColor }]}>
            {errorMessage ? 'Unable to load match schedule' : 'No match schedule downloaded'}
          </ThemedText>
          <ThemedText style={[styles.stateMessage, { color: mutedText }]}>
            {errorMessage
              ? errorMessage
              : activeEventKey
              ? `Download the latest schedule for ${activeEventKey} to get started.`
              : 'Select an event to download its match schedule.'}
          </ThemedText>
          {activeEventKey ? (
            <Pressable
              accessibilityRole="button"
              onPress={handleDownloadPress}
              disabled={isDownloading}
              style={({ pressed }) => [
                styles.downloadButton,
                { backgroundColor: accentColor },
                pressed && !isDownloading ? styles.downloadButtonPressed : null,
                isDownloading ? styles.downloadButtonDisabled : null,
              ]}
            >
              <ThemedText style={[styles.downloadButtonLabel, { color: buttonTextColor }]}>
                {isDownloading ? 'Downloading…' : 'Download Match Schedule'}
              </ThemedText>
            </Pressable>
          ) : null}
        </View>
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    gap: 8,
    marginBottom: 16,
  },
  stateWrapper: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  stateCard: {
    marginTop: 24,
    paddingHorizontal: 20,
    paddingVertical: 24,
    borderRadius: 16,
    borderWidth: 1,
    gap: 12,
  },
  stateTitle: {
    fontSize: 18,
    textAlign: 'center',
  },
  stateMessage: {
    fontSize: 16,
    textAlign: 'center',
  },
  downloadButton: {
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 12,
    alignSelf: 'center',
  },
  downloadButtonPressed: {
    opacity: 0.92,
  },
  downloadButtonDisabled: {
    opacity: 0.7,
  },
  downloadButtonLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
});
