import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  ListRenderItem,
  RefreshControl,
  StyleSheet,
  View,
} from 'react-native';
import { Stack, useFocusEffect } from 'expo-router';

import { ScreenContainer } from '@/components/layout/ScreenContainer';
import { ThemedText } from '@/components/themed-text';
import { getDbOrThrow, schema } from '@/db';
import type { FRCEvent } from '@/db/schema';
import { useThemeColor } from '@/hooks/use-theme-color';
import { getActiveEvent } from '../../services/logged-in-event';

export function EventBrowserScreen() {
  const [events, setEvents] = useState<FRCEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [activeEventKey, setActiveEventKey] = useState<string | null>(null);

  const cardBackground = useThemeColor({ light: '#FFFFFF', dark: '#111827' }, 'background');
  const cardBorder = useThemeColor({ light: 'rgba(15, 23, 42, 0.08)', dark: 'rgba(148, 163, 184, 0.25)' }, 'text');
  const mutedText = useThemeColor({ light: '#475569', dark: '#94A3B8' }, 'text');

  const fetchEvents = useCallback(async () => {
    const db = getDbOrThrow();
    const rows = db.select().from(schema.frcEvents).all();
    const activeEvent = getActiveEvent();
    return {
      events: [...rows].sort((a, b) => a.eventName.localeCompare(b.eventName)),
      activeEventKey: activeEvent,
    };
  }, []);

  useFocusEffect(
    useCallback(() => {
      let isActive = true;

      setIsLoading(true);
      setErrorMessage(null);

      fetchEvents()
        .then(({ events: data, activeEventKey: activeEvent }) => {
          if (!isActive) {
            return;
          }
          setEvents(data);
          setActiveEventKey(activeEvent);
        })
        .catch((error) => {
          if (!isActive) {
            return;
          }
          console.error('Failed to load events', error);
          const message =
            error instanceof Error ? error.message : 'An unexpected error occurred while loading events.';
          setErrorMessage(message);
        })
        .finally(() => {
          if (!isActive) {
            return;
          }
          setIsLoading(false);
        });

      return () => {
        isActive = false;
      };
    }, [fetchEvents])
  );

  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);

    fetchEvents()
      .then(({ events: data, activeEventKey: activeEvent }) => {
        setEvents(data);
        setActiveEventKey(activeEvent);
        setErrorMessage(null);
      })
      .catch((error) => {
        console.error('Failed to refresh events', error);
        const message = error instanceof Error ? error.message : 'An unexpected error occurred while refreshing events.';
        setErrorMessage(message);
      })
      .finally(() => {
        setIsRefreshing(false);
      });
  }, [fetchEvents]);

  const activeEvent = useMemo(
    () => events.find((event) => event.eventKey === activeEventKey) ?? null,
    [events, activeEventKey]
  );

  const displayedEvents = useMemo(() => {
    if (!activeEvent) {
      return events;
    }

    const otherEvents = events.filter((event) => event.eventKey !== activeEvent.eventKey);
    return [activeEvent, ...otherEvents];
  }, [activeEvent, events]);

  const renderEvent = useCallback<ListRenderItem<FRCEvent>>(
    ({ item }) => {
      const isActiveEvent = item.eventKey === activeEventKey;

      return (
        <View
          style={[
            styles.card,
            { backgroundColor: cardBackground, borderColor: cardBorder },
            isActiveEvent ? styles.activeCard : null,
          ]}
        >
          <View style={styles.cardHeader}>
            <ThemedText type="defaultSemiBold" style={styles.eventName}>
              {item.eventName}
            </ThemedText>
            {isActiveEvent ? (
              <View style={styles.activeBadge}>
                <ThemedText style={styles.activeBadgeText}>Logged-in event</ThemedText>
              </View>
            ) : null}
          </View>
          <ThemedText style={[styles.eventMeta, { color: mutedText }]}>{item.shortName ?? item.eventKey}</ThemedText>
          <ThemedText style={[styles.eventMeta, { color: mutedText }]}>Season {item.year} • Week {item.week}</ThemedText>
        </View>
      );
    },
    [activeEventKey, cardBackground, cardBorder, mutedText]
  );

  return (
    <ScreenContainer>
      <Stack.Screen options={{ title: 'Events' }} />
      {errorMessage ? (
        <View style={styles.errorContainer}>
          <ThemedText style={styles.errorText}>{errorMessage}</ThemedText>
        </View>
      ) : null}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator accessibilityLabel="Loading events" color="#0a7ea4" />
          <ThemedText style={styles.loadingText}>Loading events…</ThemedText>
        </View>
      ) : (
        <>
          {activeEventKey && !activeEvent ? (
            <View
              style={[
                styles.card,
                styles.activeEventFallback,
                { backgroundColor: cardBackground, borderColor: cardBorder },
              ]}
            >
              <ThemedText type="defaultSemiBold" style={styles.eventName}>
                Logged-in event
              </ThemedText>
              <ThemedText style={[styles.eventMeta, { color: mutedText }]}>{activeEventKey}</ThemedText>
              <ThemedText style={[styles.activeFallbackHint, { color: mutedText }]}>
                Sync general data from the App Settings screen to download full details for this event.
              </ThemedText>
            </View>
          ) : null}
          <FlatList
            data={displayedEvents}
            keyExtractor={(item) => item.eventKey}
            renderItem={renderEvent}
            contentContainerStyle={
              displayedEvents.length === 0 ? styles.emptyListContent : styles.listContent
            }
            refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <ThemedText type="defaultSemiBold">No events available</ThemedText>
                <ThemedText style={styles.emptyStateHint}>
                  Sync general data from the App Settings screen to download the latest events.
                </ThemedText>
              </View>
            }
          />
        </>
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  listContent: {
    paddingBottom: 32,
    gap: 12,
  },
  emptyListContent: {
    paddingBottom: 32,
    flexGrow: 1,
    justifyContent: 'center',
  },
  card: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    gap: 8,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  eventName: {
    fontSize: 18,
  },
  eventMeta: {
    fontSize: 14,
  },
  activeCard: {
    borderColor: '#0a7ea4',
    shadowColor: '#0a7ea4',
    shadowOpacity: 0.25,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 12,
    elevation: 6,
  },
  activeBadge: {
    backgroundColor: '#0a7ea4',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  activeBadgeText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 16,
  },
  errorContainer: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#fecaca',
    backgroundColor: '#fee2e2',
    padding: 12,
  },
  errorText: {
    color: '#991b1b',
  },
  emptyState: {
    paddingHorizontal: 16,
    alignItems: 'center',
    gap: 8,
  },
  emptyStateHint: {
    textAlign: 'center',
  },
  activeEventFallback: {
    marginBottom: 12,
  },
  activeFallbackHint: {
    fontSize: 12,
  },
});
