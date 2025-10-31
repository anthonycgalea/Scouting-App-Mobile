import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import type { EventTeam } from '@/app/services/api/events';
import type { PickListRank } from '@/app/services/pick-lists';
import { ThemedText } from '@/components/themed-text';
import { useThemeColor } from '@/hooks/use-theme-color';

interface PickListPreviewProps {
  ranks: PickListRank[];
  eventTeamsByNumber: Map<number, EventTeam>;
  selectedTeamNumbers?: Set<number>;
}

type NormalizedPickListRanks = {
  teams: PickListRank[];
  dnp: PickListRank[];
};

const recalculateRanks = (ranks: PickListRank[]) => {
  const activeRanks = ranks.filter((rank) => !rank.dnp);
  const dnpRanks = ranks.filter((rank) => rank.dnp);

  const normalizedActive = activeRanks.map((rank, index) => ({
    ...rank,
    rank: index + 1,
    notes: rank.notes?.trim() ?? '',
  }));

  const normalizedDnp = dnpRanks.map((rank, index) => ({
    ...rank,
    rank: -(index + 1),
    notes: rank.notes?.trim() ?? '',
  }));

  return [...normalizedActive, ...normalizedDnp];
};

const normalizeRanks = (
  ranks: PickListRank[],
  selectedTeamNumbers: Set<number>,
): NormalizedPickListRanks => {
  const sortedRanks = [...ranks].sort((first, second) => {
    if (first.dnp === second.dnp) {
      if (first.dnp) {
        return Math.abs(first.rank) - Math.abs(second.rank);
      }

      return first.rank - second.rank;
    }

    return first.dnp ? 1 : -1;
  });

  const recalculated = recalculateRanks(sortedRanks);

  const filtered = recalculated.filter((rank) => !selectedTeamNumbers.has(rank.teamNumber));

  return {
    teams: filtered.filter((rank) => !rank.dnp),
    dnp: filtered.filter((rank) => rank.dnp),
  };
};

const PickListEmptyState = ({ label }: { label: string }) => (
  <View style={styles.emptyState}>
    <ThemedText style={styles.emptyStateText}>{label}</ThemedText>
  </View>
);

const PickListItem = ({
  rank,
  team,
  isDnp,
  isSelected,
  mutedText,
  borderColor,
  selectedBackground,
  highlightColor,
}: {
  rank: PickListRank;
  team: EventTeam | undefined;
  isDnp: boolean;
  isSelected: boolean;
  mutedText: string;
  borderColor: string;
  selectedBackground: string;
  highlightColor: string;
}) => {
  return (
    <View
      style={[
        styles.item,
        { borderColor },
        isSelected ? { backgroundColor: selectedBackground, borderColor: highlightColor } : null,
      ]}
    >
      <View style={styles.itemHeader}>
        <View style={styles.itemRankBadge}>
          <ThemedText style={styles.itemRankText}>
            {isDnp ? 'DNP' : `#${rank.rank}`}
          </ThemedText>
        </View>
        <View style={styles.itemTeamInfo}>
          <ThemedText type="defaultSemiBold" style={styles.itemTeamNumber} numberOfLines={1}>
            {rank.teamNumber}
          </ThemedText>
          <ThemedText style={[styles.itemTeamName, { color: mutedText }]} numberOfLines={1}>
            {team?.teamName ?? 'Team information unavailable'}
          </ThemedText>
        </View>
      </View>
      {rank.notes ? (
        <ThemedText style={[styles.itemNotes, { color: mutedText }]} numberOfLines={2}>
          {rank.notes}
        </ThemedText>
      ) : null}
    </View>
  );
};

const EMPTY_SELECTED_TEAMS = new Set<number>();

export function PickListPreview({
  ranks,
  eventTeamsByNumber,
  selectedTeamNumbers = EMPTY_SELECTED_TEAMS,
}: PickListPreviewProps) {
  const { teams, dnp } = useMemo(
    () => normalizeRanks(ranks, selectedTeamNumbers),
    [ranks, selectedTeamNumbers],
  );

  const hasDnp = dnp.length > 0;

  const [activeTab, setActiveTab] = useState<'teams' | 'dnp'>(teams.length > 0 ? 'teams' : 'dnp');

  useEffect(() => {
    if (!hasDnp && activeTab === 'dnp') {
      setActiveTab('teams');
      return;
    }

    if (hasDnp && activeTab === 'teams' && teams.length === 0) {
      setActiveTab('dnp');
    }
  }, [activeTab, hasDnp, teams.length]);

  const borderColor = useThemeColor(
    { light: 'rgba(15, 23, 42, 0.08)', dark: 'rgba(148, 163, 184, 0.25)' },
    'text',
  );
  const mutedText = useThemeColor({ light: '#475569', dark: '#94A3B8' }, 'text');
  const selectedBackground = useThemeColor(
    { light: 'rgba(14, 165, 233, 0.12)', dark: 'rgba(125, 211, 252, 0.16)' },
    'tint',
  );
  const highlightColor = useThemeColor({ light: '#0ea5e9', dark: '#38bdf8' }, 'tint');
  const tabActiveColor = useThemeColor({ light: '#0a7ea4', dark: '#7cd4f7' }, 'tint');
  const tabInactiveColor = useThemeColor(
    { light: 'rgba(15, 23, 42, 0.6)', dark: 'rgba(226, 232, 240, 0.65)' },
    'text',
  );

  const renderList = (items: PickListRank[], isDnp: boolean) => {
    if (items.length === 0) {
      return (
        <PickListEmptyState
          label={isDnp ? 'No teams marked as DNP.' : 'No teams available in this pick list.'}
        />
      );
    }

    return items.map((item) => (
      <PickListItem
        key={`${isDnp ? 'dnp' : 'team'}-${item.teamNumber}-${Math.abs(item.rank)}`}
        rank={item}
        team={eventTeamsByNumber.get(item.teamNumber)}
        isDnp={isDnp}
        isSelected={selectedTeamNumbers.has(item.teamNumber)}
        mutedText={mutedText}
        borderColor={borderColor}
        selectedBackground={selectedBackground}
        highlightColor={highlightColor}
      />
    ));
  };

  if (!hasDnp) {
    return (
      <ScrollView style={styles.scroll} contentContainerStyle={styles.listContainer}>
        {renderList(teams, false)}
      </ScrollView>
    );
  }

  return (
    <View style={styles.root}>
      <View style={[styles.tabBar, { borderColor }]}> 
        <Pressable
          onPress={() => setActiveTab('teams')}
          style={[styles.tabItem, activeTab === 'teams' ? styles.activeTab : null]}
        >
          <ThemedText
            type="defaultSemiBold"
            style={{ color: activeTab === 'teams' ? tabActiveColor : tabInactiveColor }}
          >
            Teams
          </ThemedText>
        </Pressable>
        <Pressable
          onPress={() => setActiveTab('dnp')}
          style={[styles.tabItem, activeTab === 'dnp' ? styles.activeTab : null]}
        >
          <ThemedText
            type="defaultSemiBold"
            style={{ color: activeTab === 'dnp' ? tabActiveColor : tabInactiveColor }}
          >
            DNP
          </ThemedText>
        </Pressable>
      </View>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.listContainer}>
        {renderList(activeTab === 'teams' ? teams : dnp, activeTab === 'dnp')}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
  },
  scroll: {
    flex: 1,
  },
  listContainer: {
    paddingVertical: 8,
    gap: 12,
  },
  emptyState: {
    paddingVertical: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyStateText: {
    textAlign: 'center',
  },
  item: {
    padding: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    gap: 6,
  },
  itemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  itemRankBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(14, 165, 233, 0.12)',
  },
  itemRankText: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  itemTeamInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  itemTeamNumber: {
    fontSize: 18,
    fontWeight: '700',
  },
  itemTeamName: {
    fontSize: 14,
    flexShrink: 1,
  },
  itemNotes: {
    fontSize: 13,
    lineHeight: 18,
  },
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
  },
  activeTab: {
    borderBottomWidth: 2,
  },
});
