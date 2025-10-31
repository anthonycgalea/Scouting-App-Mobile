import { useQuery } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';

import type { EventTeam, OrganizationEvent } from '@/app/services/api/events';
import { fetchOrganizationEvents } from '@/app/services/api/events';
import { getPickListsFromDatabase, type PickList } from '@/app/services/pick-lists';
import { getActiveEvent } from '@/app/services/logged-in-event';
import { ScreenContainer } from '@/components/layout/ScreenContainer';
import { PickListPreview } from '@/components/pick-lists/PickListPreview';
import { ThemedText } from '@/components/themed-text';
import { useOrganization } from '@/hooks/use-organization';
import { useThemeColor } from '@/hooks/use-theme-color';
import { getDbOrThrow, schema } from '@/db';
import { eq } from 'drizzle-orm';

const ALLIANCE_GRID_COLUMNS = 3;
const ALLIANCE_GRID_ROWS = 8;
const ALLIANCE_CELL_COUNT = ALLIANCE_GRID_COLUMNS * ALLIANCE_GRID_ROWS;

const getTimestamp = (value: string | null | undefined) => {
  if (!value) {
    return 0;
  }

  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? 0 : timestamp;
};

export function PickListsScreen() {
  const { selectedOrganization } = useOrganization();
  const [selectedPickListId, setSelectedPickListId] = useState<string | null>(null);
  const [isPickListDropdownOpen, setIsPickListDropdownOpen] = useState(false);
  const [localActiveEventKey] = useState<string | null>(() => getActiveEvent());
  const [allianceSelections, setAllianceSelections] = useState<string[]>(() =>
    Array.from({ length: ALLIANCE_CELL_COUNT }, () => ''),
  );

  const accentColor = useThemeColor({ light: '#0a7ea4', dark: '#7cd4f7' }, 'tint');
  const textColor = useThemeColor({}, 'text');
  const cardBackground = useThemeColor({ light: '#FFFFFF', dark: '#111827' }, 'background');
  const borderColor = useThemeColor(
    { light: 'rgba(15, 23, 42, 0.12)', dark: 'rgba(148, 163, 184, 0.28)' },
    'text',
  );
  const mutedText = useThemeColor({ light: '#475569', dark: '#94A3B8' }, 'text');
  const chipBackground = useThemeColor(
    { light: 'rgba(15, 23, 42, 0.05)', dark: 'rgba(148, 163, 184, 0.15)' },
    'text',
  );
  const selectionHighlight = useThemeColor(
    { light: 'rgba(14, 165, 233, 0.12)', dark: 'rgba(125, 211, 252, 0.16)' },
    'tint',
  );
  const placeholderColor = useThemeColor(
    { light: 'rgba(15, 23, 42, 0.4)', dark: 'rgba(226, 232, 240, 0.4)' },
    'text',
  );
  const errorColor = useThemeColor({ light: '#dc2626', dark: '#fca5a5' }, 'text');

  const {
    data: organizationEvents = [],
    isLoading: isLoadingEvents,
    isError: isEventsError,
    error: organizationEventsError,
  } = useQuery<OrganizationEvent[]>(
    {
      queryKey: ['organization-events', selectedOrganization?.id ?? 'none'],
      queryFn: () =>
        selectedOrganization
          ? fetchOrganizationEvents({ organizationId: selectedOrganization.id })
          : Promise.resolve([]),
      enabled: Boolean(selectedOrganization),
      staleTime: 5 * 60 * 1000,
    },
  );

  const activeEventFromApi = useMemo(
    () => organizationEvents.find((event) => event.isActive) ?? null,
    [organizationEvents],
  );

  const activeEventKey = useMemo(
    () => activeEventFromApi?.eventKey ?? localActiveEventKey ?? null,
    [activeEventFromApi, localActiveEventKey],
  );

  const {
    data: pickLists = [],
    isLoading: isLoadingPickLists,
    isError: isPickListsError,
    error: pickListsError,
  } = useQuery<PickList[]>(
    {
      queryKey: ['picklists', selectedOrganization?.id ?? 'none', activeEventKey ?? 'all'],
      queryFn: async () =>
        selectedOrganization
          ? getPickListsFromDatabase({ organizationId: selectedOrganization.id })
          : [],
      enabled: Boolean(selectedOrganization),
      staleTime: 30 * 1000,
    },
  );

  const {
    data: eventTeams = [],
    isLoading: isLoadingEventTeams,
    isError: isEventTeamsError,
    error: eventTeamsError,
  } = useQuery<EventTeam[]>(
    {
      queryKey: ['event-teams', activeEventKey ?? 'none'],
      queryFn: async () => {
        if (!activeEventKey) {
          return [];
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
            eq(schema.teamEvents.teamNumber, schema.teamRecords.teamNumber),
          )
          .where(eq(schema.teamEvents.eventKey, activeEventKey))
          .all();

        return rows.map((row) => {
          const normalizedName =
            typeof row.teamName === 'string' ? row.teamName.trim() : '';
          const normalizedLocation =
            typeof row.teamLocation === 'string' ? row.teamLocation.trim() : '';

          return {
            teamNumber: row.teamNumber,
            teamName: normalizedName.length > 0 ? normalizedName : null,
            nickname: null,
            location: normalizedLocation.length > 0 ? normalizedLocation : null,
          };
        });
      },
      enabled: Boolean(activeEventKey),
      staleTime: 5 * 60 * 1000,
    },
  );

  const pickListsForDisplay = useMemo(() => {
    if (!activeEventKey) {
      return pickLists;
    }

    return pickLists.filter((list) => !list.eventKey || list.eventKey === activeEventKey);
  }, [activeEventKey, pickLists]);

  const sortedPickLists = useMemo(() => {
    return [...pickListsForDisplay].sort((first, second) => {
      if (first.favorited !== second.favorited) {
        return first.favorited ? -1 : 1;
      }

      const firstTimestamp = getTimestamp(first.updatedAt ?? first.createdAt);
      const secondTimestamp = getTimestamp(second.updatedAt ?? second.createdAt);

      return secondTimestamp - firstTimestamp;
    });
  }, [pickListsForDisplay]);

  useEffect(() => {
    if (sortedPickLists.length === 0) {
      setSelectedPickListId(null);
      return;
    }

    setSelectedPickListId((current) => {
      if (current && sortedPickLists.some((list) => list.id === current)) {
        return current;
      }

      return sortedPickLists[0]?.id ?? null;
    });
    setIsPickListDropdownOpen(false);
  }, [sortedPickLists]);

  const selectedPickList = useMemo(
    () => sortedPickLists.find((list) => list.id === selectedPickListId) ?? null,
    [selectedPickListId, sortedPickLists],
  );

  const pickListTeamNumbers = useMemo(() => {
    if (!selectedPickList) {
      return new Set<number>();
    }

    return new Set(selectedPickList.ranks.map((rank) => rank.teamNumber));
  }, [selectedPickList]);

  const selectedTeamNumbers = useMemo(() => {
    if (pickListTeamNumbers.size === 0) {
      return new Set<number>();
    }

    const numbers = allianceSelections
      .map((value) => value.trim())
      .filter((value) => value.length > 0)
      .map((value) => Number.parseInt(value, 10))
      .filter((teamNumber) => !Number.isNaN(teamNumber) && pickListTeamNumbers.has(teamNumber));

    return new Set(numbers);
  }, [allianceSelections, pickListTeamNumbers]);

  const handleAllianceSelectionChange = useCallback((index: number, value: string) => {
    const sanitizedValue = value.replace(/[^0-9]/g, '').slice(0, 5);

    setAllianceSelections((current) => {
      if (current[index] === sanitizedValue) {
        return current;
      }

      const next = [...current];
      next[index] = sanitizedValue;
      return next;
    });
  }, []);

  const eventTeamsByNumber = useMemo(
    () => new Map(eventTeams.map((team) => [team.teamNumber, team])),
    [eventTeams],
  );

  const isLoadingAny =
    isLoadingPickLists ||
    isLoadingEvents ||
    (Boolean(activeEventKey) && isLoadingEventTeams);

  const pickListErrorMessage = isPickListsError
    ? pickListsError instanceof Error
      ? pickListsError.message
      : 'Unable to load pick lists.'
    : null;

  const organizationEventsErrorMessage = isEventsError
    ? organizationEventsError instanceof Error
      ? organizationEventsError.message
      : 'Unable to load organization events.'
    : null;

  const eventTeamsErrorMessage = isEventTeamsError
    ? eventTeamsError instanceof Error
      ? eventTeamsError.message
      : 'Unable to load teams for the active event.'
    : null;

  const handleSelectPickList = useCallback((pickListId: string) => {
    setSelectedPickListId(pickListId);
    setIsPickListDropdownOpen(false);
  }, []);

  return (
    <ScreenContainer>
      <Stack.Screen options={{ title: 'Pick Lists' }} />
      <View style={styles.pageContent}>
        {organizationEventsErrorMessage ? (
          <View style={[styles.banner, { borderColor: errorColor }]}>
            <ThemedText style={[styles.bannerText, { color: errorColor }]}>{organizationEventsErrorMessage}</ThemedText>
          </View>
        ) : null}

        {eventTeamsErrorMessage ? (
          <View style={[styles.banner, { borderColor: errorColor }]}>
            <ThemedText style={[styles.bannerText, { color: errorColor }]}>{eventTeamsErrorMessage}</ThemedText>
          </View>
        ) : null}

        {pickListErrorMessage ? (
          <View style={[styles.errorContainer, { borderColor: errorColor }]}> 
            <ThemedText style={[styles.errorText, { color: errorColor }]}>{pickListErrorMessage}</ThemedText>
          </View>
        ) : null}

        {!selectedOrganization ? (
          <View style={styles.emptyState}>
            <ThemedText type="defaultSemiBold">Join an organization to access pick lists.</ThemedText>
            <ThemedText style={[styles.emptyStateHint, { color: mutedText }]}>Once you join, pick lists shared with your organization will appear here.</ThemedText>
          </View>
        ) : isLoadingAny ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator accessibilityLabel="Loading pick lists" color={accentColor} />
            <ThemedText style={[styles.loadingText, { color: mutedText }]}>Loading pick lists…</ThemedText>
          </View>
        ) : sortedPickLists.length === 0 ? (
          <View style={styles.emptyState}>
            <ThemedText type="defaultSemiBold">No pick lists available</ThemedText>
            <ThemedText style={[styles.emptyStateHint, { color: mutedText }]}>Create a pick list on the web dashboard to view it here.</ThemedText>
          </View>
        ) : (
          <View style={styles.contentWrapper}>
            <View style={styles.cardRow}>
              <View
                style={[styles.card, styles.allianceCard, { backgroundColor: cardBackground, borderColor }]}
              >
                <View style={styles.sectionHeader}>
                  <ThemedText type="title" style={styles.sectionTitle}>
                    Alliance Selection
                  </ThemedText>
                  <ThemedText style={[styles.sectionSubtitle, { color: mutedText }]}>
                    Keep track of alliance picks as they happen.
                  </ThemedText>
                </View>
                <View style={styles.allianceContent}>
                  <ThemedText style={[styles.allianceHelperText, { color: mutedText }]}>
                    Enter a team number into each slot. Teams that match the active pick list are hidden
                    from the rankings.
                  </ThemedText>
                  <View style={styles.allianceGrid}>
                    {Array.from({ length: ALLIANCE_GRID_ROWS }).map((_, rowIndex) => (
                      <View key={`row-${rowIndex}`} style={styles.allianceGridRow}>
                        {Array.from({ length: ALLIANCE_GRID_COLUMNS }).map((_, columnIndex) => {
                          const cellIndex = rowIndex * ALLIANCE_GRID_COLUMNS + columnIndex;
                          const value = allianceSelections[cellIndex] ?? '';
                          const trimmedValue = value.trim();
                          const matchesPickList =
                            trimmedValue.length > 0 &&
                            pickListTeamNumbers.has(Number.parseInt(trimmedValue, 10));

                          return (
                            <View
                              key={`cell-${cellIndex}`}
                              style={[
                                styles.allianceGridCell,
                                { borderColor },
                                matchesPickList
                                  ? { borderColor: accentColor, backgroundColor: selectionHighlight }
                                  : null,
                              ]}
                            >
                              <TextInput
                                value={value}
                                onChangeText={(text) => handleAllianceSelectionChange(cellIndex, text)}
                                keyboardType="number-pad"
                                inputMode="numeric"
                                autoCorrect={false}
                                autoCapitalize="none"
                                placeholder=""
                                placeholderTextColor={placeholderColor}
                                style={[styles.allianceGridInput, { color: textColor }]}
                                maxLength={5}
                                returnKeyType="next"
                              />
                            </View>
                          );
                        })}
                      </View>
                    ))}
                  </View>
                </View>
              </View>
              <View
                style={[styles.card, styles.pickListCard, { backgroundColor: cardBackground, borderColor }]}
              >
                <View style={styles.sectionHeader}>
                  <ThemedText type="title" style={styles.sectionTitle}>
                    Pick List
                  </ThemedText>
                  <ThemedText style={[styles.sectionSubtitle, { color: mutedText }]}>
                    Select a pick list to view the current rankings.
                  </ThemedText>
                </View>
                <View style={styles.dropdownContainer}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ expanded: isPickListDropdownOpen }}
                    onPress={() => setIsPickListDropdownOpen((current) => !current)}
                    style={[styles.dropdownTrigger, { borderColor, backgroundColor: chipBackground }]}
                  >
                    <ThemedText
                      type="defaultSemiBold"
                      style={[styles.dropdownLabel, { color: textColor }]}
                      numberOfLines={1}
                    >
                      {selectedPickList?.title ?? 'Select a pick list'}
                    </ThemedText>
                    <ThemedText style={[styles.dropdownIcon, { color: mutedText }]}>
                      {isPickListDropdownOpen ? '▲' : '▼'}
                    </ThemedText>
                  </Pressable>
                  {isPickListDropdownOpen ? (
                    <View style={[styles.dropdownList, { borderColor, backgroundColor: cardBackground }]}>
                      <ScrollView nestedScrollEnabled style={styles.dropdownScroll}>
                        {sortedPickLists.map((pickList) => {
                          const isSelected = pickList.id === selectedPickListId;
                          return (
                            <Pressable
                              key={pickList.id}
                              onPress={() => handleSelectPickList(pickList.id)}
                              style={[
                                styles.dropdownOption,
                                isSelected ? { backgroundColor: chipBackground } : null,
                              ]}
                            >
                              <ThemedText
                                style={[styles.dropdownOptionLabel, { color: textColor }]}
                                numberOfLines={1}
                              >
                                {pickList.title}
                              </ThemedText>
                            </Pressable>
                          );
                        })}
                      </ScrollView>
                    </View>
                  ) : null}
                </View>
                {selectedPickList ? (
                  <View style={styles.previewContainer}>
                    <PickListPreview
                      ranks={selectedPickList.ranks}
                      eventTeamsByNumber={eventTeamsByNumber}
                      selectedTeamNumbers={selectedTeamNumbers}
                    />
                  </View>
                ) : (
                  <View style={styles.emptySection}>
                    <ThemedText style={[styles.emptySectionText, { color: mutedText }]}>
                      Select a pick list to view the teams it contains.
                    </ThemedText>
                  </View>
                )}
              </View>
            </View>
          </View>
        )}
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  pageContent: {
    flex: 1,
    gap: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 12,
  },
  title: {
    fontSize: 28,
  },
  subtitle: {
    marginTop: 4,
    maxWidth: 520,
  },
  eventBadge: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: 'rgba(14, 165, 233, 0.12)',
    alignItems: 'flex-start',
    gap: 4,
  },
  eventBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  eventBadgeName: {
    fontSize: 16,
  },
  banner: {
    padding: 12,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  bannerText: {
    textAlign: 'center',
  },
  errorContainer: {
    padding: 12,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  errorText: {
    textAlign: 'center',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 16,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 48,
    gap: 8,
  },
  emptyStateHint: {
    textAlign: 'center',
  },
  contentWrapper: {
    flex: 1,
  },
  cardRow: {
    flex: 1,
    flexDirection: 'row',
    gap: 16,
    flexWrap: 'wrap',
    alignContent: 'stretch',
  },
  card: {
    flexGrow: 1,
    flexBasis: 0,
    flexShrink: 1,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    padding: 20,
    gap: 20,
    minWidth: 320,
    minHeight: 0,
  },
  allianceCard: {
    minHeight: 0,
  },
  pickListCard: {
    minHeight: 0,
  },
  sectionHeader: {
    gap: 4,
  },
  sectionTitle: {
    fontSize: 22,
  },
  sectionSubtitle: {
    fontSize: 14,
    lineHeight: 20,
  },
  emptySection: {
    paddingVertical: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptySectionText: {
    textAlign: 'center',
  },
  allianceContent: {
    flex: 1,
    gap: 16,
    minHeight: 0,
  },
  allianceHelperText: {
    fontSize: 14,
    lineHeight: 20,
  },
  allianceGrid: {
    flex: 1,
    gap: 12,
    minHeight: 0,
  },
  allianceGridRow: {
    flexDirection: 'row',
    gap: 12,
  },
  allianceGridCell: {
    flex: 1,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    justifyContent: 'center',
  },
  allianceGridInput: {
    paddingVertical: 10,
    paddingHorizontal: 4,
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
  },
  dropdownContainer: {
    position: 'relative',
    zIndex: 1,
  },
  dropdownTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  dropdownLabel: {
    flex: 1,
  },
  dropdownIcon: {
    fontSize: 14,
  },
  dropdownList: {
    marginTop: 8,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    maxHeight: 240,
  },
  dropdownScroll: {
    maxHeight: 240,
  },
  dropdownOption: {
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  dropdownOptionLabel: {
    fontSize: 15,
  },
  previewContainer: {
    flex: 1,
    minHeight: 0,
  },
});
