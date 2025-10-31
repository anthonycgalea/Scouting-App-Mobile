import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';

import type { EventTeam, OrganizationEvent } from '@/app/services/api/events';
import { fetchEventTeams, fetchOrganizationEvents } from '@/app/services/api/events';
import type { PickList, PickListRank } from '@/app/services/api/pick-lists';
import { fetchPickLists } from '@/app/services/api/pick-lists';
import { getActiveEvent } from '@/app/services/logged-in-event';
import { ScreenContainer } from '@/components/layout/ScreenContainer';
import { PickListPreview } from '@/components/pick-lists/PickListPreview';
import { ThemedText } from '@/components/themed-text';
import { useOrganization } from '@/hooks/use-organization';
import { useThemeColor } from '@/hooks/use-theme-color';

const DEFAULT_ALLIANCE_COUNT = 8;

type AllianceRecommendation = {
  captain: PickListRank | null;
  firstPick: PickListRank | null;
  secondPick: PickListRank | null;
  thirdPick: PickListRank | null;
};

const getTimestamp = (value: string | null | undefined) => {
  if (!value) {
    return 0;
  }

  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? 0 : timestamp;
};

const buildAllianceRecommendations = (
  ranks: PickListRank[],
  allianceCount: number,
): AllianceRecommendation[] => {
  const available = ranks.filter((rank) => !rank.dnp);
  const count = Math.min(allianceCount, available.length);

  if (count === 0) {
    return [];
  }

  const alliances: AllianceRecommendation[] = Array.from({ length: count }, () => ({
    captain: null,
    firstPick: null,
    secondPick: null,
    thirdPick: null,
  }));

  for (let index = 0; index < available.length; index += 1) {
    const allianceIndex = index % count;
    const round = Math.floor(index / count);
    const targetAlliance = alliances[allianceIndex];

    if (round === 0) {
      targetAlliance.captain ??= available[index];
      continue;
    }

    if (round === 1) {
      targetAlliance.firstPick ??= available[index];
      continue;
    }

    if (round === 2) {
      targetAlliance.secondPick ??= available[index];
      continue;
    }

    if (round === 3) {
      targetAlliance.thirdPick ??= available[index];
      continue;
    }

    break;
  }

  return alliances;
};

export function PickListsScreen() {
  const { selectedOrganization } = useOrganization();
  const [selectedPickListId, setSelectedPickListId] = useState<string | null>(null);
  const [localActiveEventKey] = useState<string | null>(() => getActiveEvent());

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
  const chipSelectedBackground = useThemeColor(
    { light: 'rgba(14, 165, 233, 0.14)', dark: 'rgba(56, 189, 248, 0.2)' },
    'tint',
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

  const activeEvent = useMemo(() => {
    if (!activeEventKey) {
      return null;
    }

    return (
      organizationEvents.find((event) => event.eventKey === activeEventKey) ??
      activeEventFromApi ??
      ({ eventKey: activeEventKey, name: activeEventKey, isActive: true } as OrganizationEvent)
    );
  }, [activeEventFromApi, activeEventKey, organizationEvents]);

  const {
    data: pickLists = [],
    isLoading: isLoadingPickLists,
    isError: isPickListsError,
    error: pickListsError,
  } = useQuery<PickList[]>(
    {
      queryKey: ['picklists', selectedOrganization?.id ?? 'none', activeEventKey ?? 'all'],
      queryFn: () =>
        selectedOrganization
          ? fetchPickLists({
              organizationId: selectedOrganization.id,
              eventKey: activeEventKey ?? undefined,
            })
          : Promise.resolve([]),
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
      queryFn: () =>
        activeEventKey ? fetchEventTeams({ eventKey: activeEventKey }) : Promise.resolve([]),
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
  }, [sortedPickLists]);

  const selectedPickList = useMemo(
    () => sortedPickLists.find((list) => list.id === selectedPickListId) ?? null,
    [selectedPickListId, sortedPickLists],
  );

  const allianceRecommendations = useMemo(() => {
    if (!selectedPickList) {
      return [];
    }

    return buildAllianceRecommendations(selectedPickList.ranks, DEFAULT_ALLIANCE_COUNT);
  }, [selectedPickList]);

  const hasThirdPicks = useMemo(
    () => allianceRecommendations.some((alliance) => alliance.thirdPick !== null),
    [allianceRecommendations],
  );

  const selectedTeamNumbers = useMemo(() => {
    const numbers = new Set<number>();

    allianceRecommendations.forEach((alliance) => {
      [alliance.captain, alliance.firstPick, alliance.secondPick, alliance.thirdPick].forEach(
        (slot) => {
          if (slot) {
            numbers.add(slot.teamNumber);
          }
        },
      );
    });

    return numbers;
  }, [allianceRecommendations]);

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
  }, []);

  const renderAllianceSlot = useCallback(
    (label: string, rank: PickListRank | null) => {
      if (!rank) {
        return (
          <View style={styles.allianceSlot}>
            <ThemedText style={[styles.allianceSlotLabel, { color: mutedText }]}>{label}</ThemedText>
            <ThemedText style={[styles.allianceSlotEmpty, { color: mutedText }]}>No team assigned</ThemedText>
          </View>
        );
      }

      const teamDetails = eventTeamsByNumber.get(rank.teamNumber);
      const teamName = teamDetails?.teamName ?? 'Team information unavailable';

      return (
        <View style={styles.allianceSlot}>
          <ThemedText style={[styles.allianceSlotLabel, { color: mutedText }]}>{label}</ThemedText>
          <View style={styles.allianceSlotContent}>
            <View style={styles.allianceRankBadge}>
              <ThemedText style={styles.allianceRankText}>#{rank.rank}</ThemedText>
            </View>
            <View style={styles.allianceTeamDetails}>
              <ThemedText type="defaultSemiBold" style={styles.allianceTeamNumber}>
                {rank.teamNumber}
              </ThemedText>
              <ThemedText style={[styles.allianceTeamName, { color: mutedText }]} numberOfLines={1}>
                {teamName}
              </ThemedText>
            </View>
          </View>
        </View>
      );
    },
    [eventTeamsByNumber, mutedText],
  );

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
          <ScrollView contentContainerStyle={styles.contentWrapper}>
            <View
              style={[styles.card, styles.allianceCard, { backgroundColor: cardBackground, borderColor }]}
            >
              <View style={styles.sectionHeader}>
                <ThemedText type="title" style={styles.sectionTitle}>
                  Alliance overview
                </ThemedText>
                <ThemedText style={[styles.sectionSubtitle, { color: mutedText }]}>Recommendations based on the selected pick list.</ThemedText>
              </View>
              {allianceRecommendations.length === 0 ? (
                <View style={styles.emptySection}>
                  <ThemedText style={[styles.emptySectionText, { color: mutedText }]}>Add ranked teams to your pick list to generate alliance suggestions.</ThemedText>
                </View>
              ) : (
                <View style={styles.allianceList}>
                  {allianceRecommendations.map((alliance, index) => (
                    <View
                      key={`alliance-${index}`}
                      style={[styles.allianceItem, { borderColor }]}
                    >
                      <ThemedText type="defaultSemiBold" style={styles.allianceTitle}>
                        Alliance {index + 1}
                      </ThemedText>
                      {renderAllianceSlot('Captain', alliance.captain)}
                      {renderAllianceSlot('First pick', alliance.firstPick)}
                      {renderAllianceSlot('Second pick', alliance.secondPick)}
                      {hasThirdPicks ? renderAllianceSlot('Third pick', alliance.thirdPick) : null}
                    </View>
                  ))}
                </View>
              )}
            </View>
            <View
              style={[styles.card, styles.pickListCard, { backgroundColor: cardBackground, borderColor }]}
            >
              <View style={styles.sectionHeader}>
                <ThemedText type="title" style={styles.sectionTitle}>
                  Pick lists
                </ThemedText>
                <ThemedText style={[styles.sectionSubtitle, { color: mutedText }]}>Select a pick list to view the current rankings.</ThemedText>
              </View>
              <View style={styles.pickListChips}>
                {sortedPickLists.map((pickList) => {
                  const isSelected = pickList.id === selectedPickListId;
                  return (
                    <Pressable
                      key={pickList.id}
                      onPress={() => handleSelectPickList(pickList.id)}
                      style={[
                        styles.pickListChip,
                        { backgroundColor: chipBackground, borderColor },
                        isSelected ? { backgroundColor: chipSelectedBackground, borderColor: accentColor } : null,
                      ]}
                    >
                      {pickList.favorited ? (
                        <Ionicons
                          name="star"
                          size={14}
                          color={accentColor}
                          style={styles.favoriteIcon}
                          accessibilityElementsHidden
                        />
                      ) : null}
                      <ThemedText
                        type="defaultSemiBold"
                        style={[styles.pickListChipLabel, { color: isSelected ? accentColor : textColor }]}
                        numberOfLines={1}
                      >
                        {pickList.title}
                      </ThemedText>
                    </Pressable>
                  );
                })}
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
                  <ThemedText style={[styles.emptySectionText, { color: mutedText }]}>Select a pick list to view the teams it contains.</ThemedText>
                </View>
              )}
            </View>
          </ScrollView>
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
    flexGrow: 1,
    flexDirection: 'row',
    gap: 16,
  },
  card: {
    flex: 1,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    padding: 20,
    gap: 20,
    minWidth: 320,
  },
  allianceCard: {
    flex: 1.1,
  },
  pickListCard: {
    flex: 1,
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
  allianceList: {
    gap: 12,
  },
  allianceItem: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    padding: 16,
    gap: 12,
  },
  allianceTitle: {
    fontSize: 18,
  },
  allianceSlot: {
    gap: 8,
  },
  allianceSlotLabel: {
    fontSize: 13,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    fontWeight: '600',
  },
  allianceSlotEmpty: {
    fontSize: 14,
  },
  allianceSlotContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  allianceRankBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(14, 165, 233, 0.12)',
  },
  allianceRankText: {
    fontSize: 12,
    fontWeight: '600',
  },
  allianceTeamDetails: {
    flex: 1,
    gap: 2,
  },
  allianceTeamNumber: {
    fontSize: 16,
    fontWeight: '600',
  },
  allianceTeamName: {
    fontSize: 14,
  },
  pickListChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  pickListChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  pickListChipLabel: {
    maxWidth: 200,
  },
  favoriteIcon: {
    marginRight: 2,
  },
  previewContainer: {
    flex: 1,
  },
});
