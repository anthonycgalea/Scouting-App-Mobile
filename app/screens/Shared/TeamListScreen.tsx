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

import { and, eq } from 'drizzle-orm';
import { useFocusEffect } from 'expo-router';

import { retrieveEventInfo } from '@/app/services/event-info';
import { getActiveEvent } from '@/app/services/logged-in-event';
import { ScreenContainer } from '@/components/layout/ScreenContainer';
import { ThemedText } from '@/components/themed-text';
import { StacklessHeader } from '@/components/layout/StacklessHeader';
import { getDbOrThrow, schema } from '@/db';
import { useOrganization } from '@/hooks/use-organization';
import { useThemeColor } from '@/hooks/use-theme-color';

export interface TeamListItem {
  number: number;
  name: string;
  location: string;
}

export interface TeamListScreenProps {
  title: string;
  onTeamPress?: (team: TeamListItem) => void;
  showPitScoutingStatus?: boolean;
  showPrescoutProgress?: boolean;
  showRobotPhotoStatus?: boolean;
}

const normalizeText = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

export function TeamListScreen({
  title,
  onTeamPress,
  showPitScoutingStatus = false,
  showPrescoutProgress = false,
  showRobotPhotoStatus = false,
}: TeamListScreenProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [teams, setTeams] = useState<TeamListItem[]>([]);
  const [activeEventKey, setActiveEventKey] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDownloading, setIsDownloading] = useState(false);
  const [scoutedTeamNumbers, setScoutedTeamNumbers] = useState<number[]>([]);
  const [prescoutMatchCounts, setPrescoutMatchCounts] = useState<Record<number, number>>({});
  const [robotPhotoTeamNumbers, setRobotPhotoTeamNumbers] = useState<number[]>([]);
  const [robotPhotoCounts, setRobotPhotoCounts] = useState<Record<number, number>>({});

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
  const scoutedRowBackground = useThemeColor({ light: '#E2E8F0', dark: '#1F2937' }, 'background');
  const scoutedRowTextColor = useThemeColor({ light: '#475569', dark: '#CBD5F5' }, 'text');
  const prescoutHighlightColor = useThemeColor({ light: '#DCFCE7', dark: 'rgba(34, 197, 94, 0.25)' }, 'background');
  const prescoutHighlightBorderColor = useThemeColor({ light: '#86EFAC', dark: 'rgba(134, 239, 172, 0.6)' }, 'tint');
  const prescoutHighlightTextColor = useThemeColor({ light: '#166534', dark: '#86EFAC' }, 'text');
  const { selectedOrganization } = useOrganization();
  const selectedOrganizationId = selectedOrganization?.id ?? null;

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
      .map((row) => {
        const normalizedName =
          typeof row.teamName === 'string' ? row.teamName.trim() : '';
        const normalizedLocation =
          typeof row.teamLocation === 'string' ? row.teamLocation.trim() : '';

        return {
          number: row.teamNumber,
          name: normalizedName.length > 0 ? normalizedName : `Team ${row.teamNumber}`,
          location: normalizedLocation,
        };
      })
      .sort((a, b) => a.number - b.number);

    let alreadyScoutedTeams: number[] = [];
    const prescoutMatchCountsByTeam: Record<number, number> = {};
    let robotPhotoTeams: number[] = [];
    const robotPhotoCountsByTeam: Record<number, number> = {};

    if (showPitScoutingStatus && selectedOrganizationId !== null) {
      const scoutedRows = db
        .select({ teamNumber: schema.alreadyPitScouteds.teamNumber })
        .from(schema.alreadyPitScouteds)
        .where(
          and(
            eq(schema.alreadyPitScouteds.eventCode, eventKey),
            eq(schema.alreadyPitScouteds.organizationId, selectedOrganizationId)
          )
        )
        .all();

      alreadyScoutedTeams = scoutedRows.map((row) => row.teamNumber);
    }

    if (showPrescoutProgress) {
      const recordedPrescoutMatches = db
        .select({
          teamNumber: schema.alreadyPrescouteds.teamNumber,
          matchNumber: schema.alreadyPrescouteds.matchNumber,
          matchLevel: schema.alreadyPrescouteds.matchLevel,
        })
        .from(schema.alreadyPrescouteds)
        .where(eq(schema.alreadyPrescouteds.eventKey, eventKey))
        .all();

      const localPrescoutMatches = db
        .select({
          teamNumber: schema.prescout2026.teamNumber,
          matchNumber: schema.prescout2026.matchNumber,
          matchLevel: schema.prescout2026.matchLevel,
        })
        .from(schema.prescout2026)
        .where(eq(schema.prescout2026.eventKey, eventKey))
        .all();

      const matchSets = new Map<number, Set<string>>();
      const addMatch = (teamNumber: number, matchNumber: number | null, matchLevel: string | null) => {
        if (matchNumber == null) {
          return;
        }

        const normalizedLevel = (matchLevel ?? '').toLowerCase();
        const key = `${normalizedLevel}-${matchNumber}`;
        const existingSet = matchSets.get(teamNumber);

        if (existingSet) {
          existingSet.add(key);
        } else {
          matchSets.set(teamNumber, new Set([key]));
        }
      };

      recordedPrescoutMatches.forEach((row) => {
        addMatch(row.teamNumber, row.matchNumber, row.matchLevel);
      });

      localPrescoutMatches.forEach((row) => {
        addMatch(row.teamNumber, row.matchNumber, row.matchLevel);
      });

      matchSets.forEach((set, teamNumber) => {
        prescoutMatchCountsByTeam[teamNumber] = set.size;
      });
    }

    if (showRobotPhotoStatus) {
      const remotePhotoRows = db
        .select({
          teamNumber: schema.alreadyRobotPhotos.teamNumber,
          imageUrl: schema.alreadyRobotPhotos.imageUrl,
        })
        .from(schema.alreadyRobotPhotos)
        .where(eq(schema.alreadyRobotPhotos.eventKey, eventKey))
        .all();

      const remoteUrlMap = new Map<number, Set<string>>();

      for (const row of remotePhotoRows) {
        const teamNumber = row.teamNumber;

        if (typeof teamNumber !== 'number') {
          continue;
        }

        robotPhotoCountsByTeam[teamNumber] = (robotPhotoCountsByTeam[teamNumber] ?? 0) + 1;

        const rawUrl = typeof row.imageUrl === 'string' ? row.imageUrl.trim() : '';

        if (rawUrl.length > 0) {
          const existing = remoteUrlMap.get(teamNumber);

          if (existing) {
            existing.add(rawUrl);
          } else {
            remoteUrlMap.set(teamNumber, new Set([rawUrl]));
          }
        }
      }

      const localPhotoRows = db
        .select({
          teamNumber: schema.robotPhotos.teamNumber,
          remoteUrl: schema.robotPhotos.remoteUrl,
        })
        .from(schema.robotPhotos)
        .where(eq(schema.robotPhotos.eventKey, eventKey))
        .all();

      for (const row of localPhotoRows) {
        const teamNumber = row.teamNumber;

        if (typeof teamNumber !== 'number') {
          continue;
        }

        const remoteUrl = typeof row.remoteUrl === 'string' ? row.remoteUrl.trim() : '';

        if (remoteUrl.length > 0) {
          const existing = remoteUrlMap.get(teamNumber);

          if (existing?.has(remoteUrl)) {
            continue;
          }
        }

        robotPhotoCountsByTeam[teamNumber] = (robotPhotoCountsByTeam[teamNumber] ?? 0) + 1;
      }

      robotPhotoTeams = Object.entries(robotPhotoCountsByTeam)
        .filter(([, count]) => count > 0)
        .map(([team]) => Number(team))
        .sort((a, b) => a - b);
    }

    return {
      eventKey,
      teams: mapped,
      alreadyScoutedTeams,
      prescoutMatchCountsByTeam,
      robotPhotoTeams,
      robotPhotoCountsByTeam,
    };
  }, [showPitScoutingStatus, selectedOrganizationId, showPrescoutProgress, showRobotPhotoStatus]);

  useFocusEffect(
    useCallback(() => {
      setIsLoading(true);

      try {
        const {
          eventKey,
          teams: data,
          alreadyScoutedTeams,
          prescoutMatchCountsByTeam,
          robotPhotoTeams,
          robotPhotoCountsByTeam,
        } = loadTeamsFromDb();
        setActiveEventKey(eventKey);
        setTeams(data);
        setScoutedTeamNumbers(alreadyScoutedTeams);
        setPrescoutMatchCounts(prescoutMatchCountsByTeam);
        setRobotPhotoTeamNumbers(robotPhotoTeams);
        setRobotPhotoCounts(robotPhotoCountsByTeam);
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
        setScoutedTeamNumbers([]);
        setPrescoutMatchCounts({});
        setRobotPhotoTeamNumbers([]);
        setRobotPhotoCounts({});
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

  const scoutedTeamSet = useMemo(() => new Set(scoutedTeamNumbers), [scoutedTeamNumbers]);
  const robotPhotoTeamSet = useMemo(
    () => new Set(robotPhotoTeamNumbers),
    [robotPhotoTeamNumbers],
  );

  const organizedTeams = useMemo(() => {
    let availablePool = filteredTeams;
    const scouted: TeamListItem[] = [];

    if (showPitScoutingStatus) {
      const availableAfterPit: TeamListItem[] = [];

      availablePool.forEach((team) => {
        if (scoutedTeamSet.has(team.number)) {
          scouted.push(team);
        } else {
          availableAfterPit.push(team);
        }
      });

      availablePool = availableAfterPit;
    }

    let photoed: TeamListItem[] = [];

    if (showRobotPhotoStatus) {
      const availableAfterPhotos: TeamListItem[] = [];
      const photoedTeams: TeamListItem[] = [];

      availablePool.forEach((team) => {
        if (robotPhotoTeamSet.has(team.number)) {
          photoedTeams.push(team);
        } else {
          availableAfterPhotos.push(team);
        }
      });

      availablePool = availableAfterPhotos;
      photoed = photoedTeams;
    }

    return { available: availablePool, scouted, photoed };
  }, [
    filteredTeams,
    robotPhotoTeamSet,
    scoutedTeamSet,
    showPitScoutingStatus,
    showRobotPhotoStatus,
  ]);

  const handleDownloadPress = useCallback(async () => {
    if (isDownloading) {
      return;
    }

    try {
      setIsDownloading(true);
      await retrieveEventInfo();
      const {
        eventKey,
        teams: data,
        alreadyScoutedTeams,
        prescoutMatchCountsByTeam,
        robotPhotoTeams,
        robotPhotoCountsByTeam,
      } = loadTeamsFromDb();
      setActiveEventKey(eventKey);
      setTeams(data);
      setScoutedTeamNumbers(alreadyScoutedTeams);
      setPrescoutMatchCounts(prescoutMatchCountsByTeam);
      setRobotPhotoTeamNumbers(robotPhotoTeams);
      setRobotPhotoCounts(robotPhotoCountsByTeam);
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
  const availableTeams = organizedTeams.available;
  const alreadyScoutedTeamsList = organizedTeams.scouted;
  const alreadyPhotoedTeams = organizedTeams.photoed ?? [];
  const hasFilteredTeams =
    showPitScoutingStatus || showRobotPhotoStatus
      ? availableTeams.length + alreadyScoutedTeamsList.length + alreadyPhotoedTeams.length > 0
      : filteredTeams.length > 0;
  const isInteractive = typeof onTeamPress === 'function';

  return (
    <ScreenContainer>
      <StacklessHeader title={title} />
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
              showPitScoutingStatus ? (
                <>
                  {availableTeams.map((team) => (
                    <Pressable
                      key={`available-${team.number}`}
                      accessibilityRole={isInteractive ? 'button' : undefined}
                      disabled={!isInteractive}
                      onPress={isInteractive ? () => onTeamPress(team) : undefined}
                      style={({ pressed }) => [
                        styles.teamRow,
                        {
                          backgroundColor: backgroundCard,
                          borderColor,
                          opacity: pressed && isInteractive ? 0.95 : 1,
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
                        {team.location ? (
                          <ThemedText style={[styles.teamLocation, { color: mutedTextColor }]}>
                            {team.location}
                          </ThemedText>
                        ) : null}
                      </View>
                    </Pressable>
                  ))}
                  {alreadyScoutedTeamsList.length > 0 ? (
                    <>
                      <View style={styles.alreadyScoutedHeader}>
                        <ThemedText
                          type="defaultSemiBold"
                          style={[styles.alreadyScoutedHeaderText, { color: mutedTextColor }]}
                        >
                          Already Scouted
                        </ThemedText>
                      </View>
                      {alreadyScoutedTeamsList.map((team) => (
                        <Pressable
                          key={`scouted-${team.number}`}
                          accessibilityRole={isInteractive ? 'button' : undefined}
                          disabled={!isInteractive}
                          onPress={isInteractive ? () => onTeamPress(team) : undefined}
                          style={({ pressed }) => [
                            styles.teamRow,
                            styles.scoutedTeamRow,
                            {
                              backgroundColor: scoutedRowBackground,
                              borderColor,
                            },
                            pressed && isInteractive ? styles.scoutedTeamRowPressed : null,
                          ]}
                        >
                          <ThemedText
                            type="defaultSemiBold"
                            style={[styles.teamNumber, { color: scoutedRowTextColor }]}
                          >
                            {team.number}
                          </ThemedText>
                          <View style={styles.teamDetails}>
                            <ThemedText
                              type="defaultSemiBold"
                              style={[styles.teamName, { color: scoutedRowTextColor }]}
                            >
                              {team.name}
                            </ThemedText>
                            {team.location ? (
                              <ThemedText style={[styles.teamLocation, { color: scoutedRowTextColor }]}>
                                {team.location}
                              </ThemedText>
                            ) : null}
                          </View>
                        </Pressable>
                      ))}
                    </>
                  ) : null}
                  {showRobotPhotoStatus && alreadyPhotoedTeams.length > 0 ? (
                    <>
                      <View style={styles.alreadyScoutedHeader}>
                        <ThemedText
                          type="defaultSemiBold"
                          style={[styles.alreadyScoutedHeaderText, { color: mutedTextColor }]}
                        >
                          Already Photoed
                        </ThemedText>
                      </View>
                      {alreadyPhotoedTeams.map((team) => {
                        const photoCount = robotPhotoCounts[team.number] ?? 0;
                        const photoLabel = photoCount === 1 ? '1 photo' : `${photoCount} photos`;

                        return (
                          <Pressable
                            key={`photoed-${team.number}`}
                            accessibilityRole={isInteractive ? 'button' : undefined}
                            disabled={!isInteractive}
                            onPress={isInteractive ? () => onTeamPress(team) : undefined}
                            style={({ pressed }) => [
                              styles.teamRow,
                              {
                                backgroundColor: backgroundCard,
                                borderColor,
                                opacity: pressed && isInteractive ? 0.95 : 1,
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
                              {team.location ? (
                                <ThemedText style={[styles.teamLocation, { color: mutedTextColor }]}>
                                  {team.location}
                                </ThemedText>
                              ) : null}
                            </View>
                            {photoCount > 0 ? (
                              <View style={styles.photoCountWrapper}>
                                <ThemedText type="defaultSemiBold" style={[styles.photoCountText, { color: mutedTextColor }]}>
                                  {photoLabel}
                                </ThemedText>
                              </View>
                            ) : null}
                          </Pressable>
                        );
                      })}
                    </>
                  ) : null}
                </>
              ) : showRobotPhotoStatus ? (
                <>
                  {availableTeams.map((team) => {
                    const prescoutCount = showPrescoutProgress
                      ? prescoutMatchCounts[team.number] ?? 0
                      : 0;
                    const hasCompletedPrescout = showPrescoutProgress && prescoutCount >= 10;

                    return (
                      <Pressable
                        key={`available-${team.number}`}
                        accessibilityRole={isInteractive ? 'button' : undefined}
                        disabled={!isInteractive}
                        onPress={isInteractive ? () => onTeamPress(team) : undefined}
                        style={({ pressed }) => [
                          styles.teamRow,
                          {
                            backgroundColor: hasCompletedPrescout
                              ? prescoutHighlightColor
                              : backgroundCard,
                            borderColor: hasCompletedPrescout ? prescoutHighlightBorderColor : borderColor,
                            opacity: pressed && isInteractive ? 0.95 : 1,
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
                          {team.location ? (
                            <ThemedText style={[styles.teamLocation, { color: mutedTextColor }]}>
                              {team.location}
                            </ThemedText>
                          ) : null}
                        </View>
                        {showPrescoutProgress ? (
                          <View style={styles.teamPrescoutProgress}>
                            <ThemedText
                              type="defaultSemiBold"
                              style={[
                                styles.teamPrescoutCount,
                                { color: hasCompletedPrescout ? prescoutHighlightTextColor : mutedTextColor },
                              ]}
                            >
                              ({prescoutCount}/10)
                            </ThemedText>
                          </View>
                        ) : null}
                      </Pressable>
                    );
                  })}
                  {alreadyPhotoedTeams.length > 0 ? (
                    <>
                      <View style={styles.alreadyScoutedHeader}>
                        <ThemedText
                          type="defaultSemiBold"
                          style={[styles.alreadyScoutedHeaderText, { color: mutedTextColor }]}
                        >
                          Already Photoed
                        </ThemedText>
                      </View>
                      {alreadyPhotoedTeams.map((team) => {
                        const photoCount = robotPhotoCounts[team.number] ?? 0;
                        const photoLabel = photoCount === 1 ? '1 photo' : `${photoCount} photos`;

                        return (
                          <Pressable
                            key={`photoed-${team.number}`}
                            accessibilityRole={isInteractive ? 'button' : undefined}
                            disabled={!isInteractive}
                            onPress={isInteractive ? () => onTeamPress(team) : undefined}
                            style={({ pressed }) => [
                              styles.teamRow,
                              {
                                backgroundColor: backgroundCard,
                                borderColor,
                                opacity: pressed && isInteractive ? 0.95 : 1,
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
                              {team.location ? (
                                <ThemedText style={[styles.teamLocation, { color: mutedTextColor }]}>
                                  {team.location}
                                </ThemedText>
                              ) : null}
                            </View>
                            {photoCount > 0 ? (
                              <View style={styles.photoCountWrapper}>
                                <ThemedText type="defaultSemiBold" style={[styles.photoCountText, { color: mutedTextColor }]}>
                                  {photoLabel}
                                </ThemedText>
                              </View>
                            ) : null}
                          </Pressable>
                        );
                      })}
                    </>
                  ) : null}
                </>
              ) : (
                filteredTeams.map((team) => {
                  const prescoutCount = showPrescoutProgress
                    ? prescoutMatchCounts[team.number] ?? 0
                    : 0;
                  const hasCompletedPrescout = showPrescoutProgress && prescoutCount >= 10;

                  return (
                    <Pressable
                      key={team.number}
                      accessibilityRole={isInteractive ? 'button' : undefined}
                      disabled={!isInteractive}
                      onPress={isInteractive ? () => onTeamPress(team) : undefined}
                      style={({ pressed }) => [
                        styles.teamRow,
                        {
                          backgroundColor: hasCompletedPrescout ? prescoutHighlightColor : backgroundCard,
                          borderColor: hasCompletedPrescout ? prescoutHighlightBorderColor : borderColor,
                          opacity: pressed && isInteractive ? 0.95 : 1,
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
                        {team.location ? (
                          <ThemedText style={[styles.teamLocation, { color: mutedTextColor }]}>
                            {team.location}
                          </ThemedText>
                        ) : null}
                      </View>
                      {showPrescoutProgress ? (
                        <View style={styles.teamPrescoutProgress}>
                          <ThemedText
                            type="defaultSemiBold"
                            style={[
                              styles.teamPrescoutCount,
                              { color: hasCompletedPrescout ? prescoutHighlightTextColor : mutedTextColor },
                            ]}
                          >
                            ({prescoutCount}/10)
                          </ThemedText>
                        </View>
                      ) : null}
                    </Pressable>
                  );
                })
              )
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
  alreadyScoutedHeader: {
    marginTop: 12,
    paddingHorizontal: 4,
  },
  alreadyScoutedHeaderText: {
    textTransform: 'uppercase',
    fontSize: 14,
    letterSpacing: 0.6,
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
  scoutedTeamRow: {
    opacity: 0.85,
  },
  scoutedTeamRowPressed: {
    opacity: 0.7,
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
  teamPrescoutProgress: {
    marginLeft: 8,
    alignItems: 'flex-end',
  },
  teamPrescoutCount: {
    fontSize: 16,
  },
  photoCountWrapper: {
    marginLeft: 8,
    alignItems: 'flex-end',
  },
  photoCountText: {
    fontSize: 16,
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
