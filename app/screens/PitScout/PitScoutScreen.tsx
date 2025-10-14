import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';

import { Stack, useFocusEffect, useRouter } from 'expo-router';
import { eq } from 'drizzle-orm';

import { ScreenContainer } from '@/components/layout/ScreenContainer';
import { ThemedText } from '@/components/themed-text';
import { useThemeColor } from '@/hooks/use-theme-color';
import { getDbOrThrow, schema } from '@/db';
import { retrieveEventInfo } from '@/app/services/event-info';
import { getActiveEvent } from '@/app/services/logged-in-event';

interface TeamListItem {
  number: number;
  name: string;
  location: string;
}

const normalizeText = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

export function PitScoutScreen() {
  const [searchTerm, setSearchTerm] = useState('');
  const [teams, setTeams] = useState<TeamListItem[]>([]);
  const [activeEventKey, setActiveEventKey] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDownloading, setIsDownloading] = useState(false);
  const router = useRouter();

  const backgroundCard = useThemeColor({ light: '#FFFFFF', dark: '#111827' }, 'background');
  const searchBackground = useThemeColor({ light: '#F1F5F9', dark: '#1F2937' }, 'background');
  const borderColor = useThemeColor({ light: 'rgba(15, 23, 42, 0.08)', dark: 'rgba(148, 163, 184, 0.25)' }, 'text');
  const placeholderColor = useThemeColor(
    { light: 'rgba(15, 23, 42, 0.45)', dark: 'rgba(148, 163, 184, 0.65)' },
    'text'
  );
  const mutedTextColor = useThemeColor(
    { light: 'rgba(15, 23, 42, 0.6)', dark: 'rgba(226, 232, 240, 0.65)' },
    'text'
  );
  const inputTextColor = useThemeColor({}, 'text');
  const accentColor = useThemeColor({ light: '#2563EB', dark: '#1E3A8A' }, 'tint');
  const buttonTextColor = '#F8FAFC';

  const loadTeamsFromDb = useCallback(() => {
    const eventKey = getActiveEvent();

    if (!eventKey) {
      throw new Error('No event is currently selected. Please select an event to view its team list.');
    }

    const db = getDbOrThrow();
    const rows = db
      .select({
        teamNumber: schema.teamEvents.teamNumber,
        teamName: schema.teamRecords.teamName,
        teamLocation: schema.teamRecords.location,
      })
      .from(schema.teamEvents)
      .innerJoin(
        schema.teamRecords,
        eq(schema.teamEvents.teamNumber, schema.teamRecords.teamNumber)
      )
      .where(eq(schema.teamEvents.eventKey, eventKey))
      .all();

    const mapped = rows
      .map((row) => ({
        number: row.teamNumber,
        name: row.teamName,
        location: row.teamLocation ?? 'Location unavailable',
      }))
      .sort((a, b) => a.number - b.number);

    return { eventKey, teams: mapped };
  }, []);

  useFocusEffect(
    useCallback(() => {
      setIsLoading(true);

      try {
        const { eventKey, teams: data } = loadTeamsFromDb();
        setActiveEventKey(eventKey);
        setTeams(data);
        setErrorMessage(null);
      } catch (error) {
        console.error('Failed to load team list', error);
        const message =
          error instanceof Error
            ? error.message
            : 'An unexpected error occurred while loading the team list.';
        setErrorMessage(message);
        setActiveEventKey(null);
        setTeams([]);
      } finally {
        setIsLoading(false);
      }

      return () => {};
    }, [loadTeamsFromDb])
  );

  const filteredTeams = useMemo(() => {
    const trimmedSearch = searchTerm.trim();

    if (!trimmedSearch) {
      return teams;
    }

    const normalizedSearch = normalizeText(trimmedSearch);

    return teams.filter((team) => {
      const normalizedName = normalizeText(team.name);
      const normalizedLocation = normalizeText(team.location);
      const normalizedNumber = String(team.number);

      return (
        normalizedName.includes(normalizedSearch) ||
        normalizedLocation.includes(normalizedSearch) ||
        normalizedNumber.includes(normalizedSearch)
      );
    });
  }, [searchTerm, teams]);

  const handleTeamPress = (team: TeamListItem) => {
    router.push({
      pathname: '/(drawer)/pit-scout/team-details',
      params: {
        teamNumber: String(team.number),
        teamName: team.name,
      },
    });
  };

  const handleDownloadPress = useCallback(async () => {
    if (isDownloading) {
      return;
    }

    try {
      setIsDownloading(true);
      await retrieveEventInfo();
      const { eventKey, teams: data } = loadTeamsFromDb();
      setActiveEventKey(eventKey);
      setTeams(data);
      setErrorMessage(null);

      if (data.length === 0) {
        Alert.alert('No team list available', 'The event has not published a team list yet.');
      }
    } catch (error) {
      console.error('Failed to download team list', error);
      const message =
        error instanceof Error
          ? error.message
          : 'An unexpected error occurred while downloading the team list.';
      Alert.alert('Download failed', message);
    } finally {
      setIsDownloading(false);
    }
  }, [isDownloading, loadTeamsFromDb]);

  const hasTeams = teams.length > 0;
  const hasFilteredTeams = filteredTeams.length > 0;

  return (
    <ScreenContainer>
      <Stack.Screen options={{ title: 'Pit Scout' }} />
      {isLoading ? (
        <View style={styles.stateWrapper}>
          <ActivityIndicator accessibilityLabel="Loading team list" color={accentColor} />
          <ThemedText style={[styles.stateMessage, { color: mutedTextColor }]}>Loading team list…</ThemedText>
        </View>
      ) : hasTeams ? (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {activeEventKey ? (
            <ThemedText style={[styles.eventCaption, { color: mutedTextColor }]}>Viewing teams for {activeEventKey}</ThemedText>
          ) : null}
          <View style={[styles.searchContainer, { backgroundColor: searchBackground, borderColor }]}>
            <TextInput
              value={searchTerm}
              onChangeText={setSearchTerm}
              placeholder="Search"
              placeholderTextColor={placeholderColor}
              style={[styles.searchInput, { color: inputTextColor }]}
              autoCorrect={false}
              autoCapitalize="none"
              clearButtonMode="while-editing"
            />
          </View>

          <View style={styles.listContainer}>
            {hasFilteredTeams ? (
              filteredTeams.map((team) => (
                <Pressable
                  key={team.number}
                  accessibilityRole="button"
                  onPress={() => handleTeamPress(team)}
                  style={({ pressed }) => [
                    styles.teamRow,
                    {
                      backgroundColor: backgroundCard,
                      borderColor,
                      opacity: pressed ? 0.95 : 1,
                    },
                  ]}
                >
                  <ThemedText type="defaultSemiBold" style={styles.teamNumber}>
                    {team.number}
                  </ThemedText>
                  <View style={styles.teamDetails}>
                    <ThemedText type="defaultSemiBold" style={styles.teamName}>
                      {team.name}
                    </ThemedText>
                    <ThemedText style={[styles.teamLocation, { color: mutedTextColor }]}>
                      {team.location}
                    </ThemedText>
                  </View>
                </Pressable>
              ))
            ) : (
              <View style={[styles.noResultsCard, { borderColor }]}> 
                <ThemedText style={[styles.noResultsText, { color: mutedTextColor }]}>No teams match your search.</ThemedText>
              </View>
            )}
          </View>
        </ScrollView>
      ) : (
        <View style={styles.emptyWrapper}>
          <View style={[styles.stateCard, { backgroundColor: backgroundCard, borderColor }]}> 
            <ThemedText type="defaultSemiBold" style={[styles.stateTitle, { color: inputTextColor }]}> 
              {errorMessage ? 'Unable to load team list' : 'No team list downloaded'}
            </ThemedText>
            <ThemedText style={[styles.stateMessage, { color: mutedTextColor }]}> 
              {errorMessage
                ? errorMessage
                : activeEventKey
                ? `Download the latest team list for ${activeEventKey} to get started.`
                : 'Select an event to download its team list.'}
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
                  {isDownloading ? 'Downloading…' : 'Download Team List'}
                </ThemedText>
              </Pressable>
            ) : null}
          </View>
        </View>
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingBottom: 32,
    gap: 24,
  },
  searchContainer: {
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  searchInput: {
    fontSize: 18,
  },
  listContainer: {
    gap: 12,
  },
  teamRow: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  teamNumber: {
    fontSize: 20,
    minWidth: 64,
  },
  teamDetails: {
    flex: 1,
  },
  teamName: {
    fontSize: 18,
    marginBottom: 4,
  },
  teamLocation: {
    fontSize: 14,
  },
  stateWrapper: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  stateCard: {
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
  emptyWrapper: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  noResultsCard: {
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 20,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  noResultsText: {
    fontSize: 16,
  },
  eventCaption: {
    textAlign: 'center',
    fontSize: 16,
  },
});
