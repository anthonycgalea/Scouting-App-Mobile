import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import { Stack, useFocusEffect } from 'expo-router';

import { ScreenContainer } from '@/components/layout/ScreenContainer';
import { ThemedText } from '@/components/themed-text';
import { getDbOrThrow, schema } from '@/db';
import type { FRCEvent } from '@/db/schema';
import { useThemeColor } from '@/hooks/use-theme-color';

export function EventBrowserScreen() {
  const [events, setEvents] = useState<FRCEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const cardBackground = useThemeColor({ light: '#FFFFFF', dark: '#111827' }, 'background');
  const cardBorder = useThemeColor({ light: 'rgba(15, 23, 42, 0.08)', dark: 'rgba(148, 163, 184, 0.25)' }, 'text');
  const mutedText = useThemeColor({ light: '#475569', dark: '#94A3B8' }, 'text');

  const fetchEvents = useCallback(async () => {
    const db = getDbOrThrow();
    const rows = db.select().from(schema.frcEvents).all();
    return [...rows].sort((a, b) => a.eventName.localeCompare(b.eventName));
  }, []);

  useFocusEffect(
    useCallback(() => {
      let isActive = true;

      setIsLoading(true);
      setErrorMessage(null);

      fetchEvents()
        .then((data) => {
          if (!isActive) {
            return;
          }
          setEvents(data);
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
      .then((data) => {
        setEvents(data);
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

  const renderEvent = useCallback(
    ({ item }: { item: FRCEvent }) => (
      <View style={[styles.card, { backgroundColor: cardBackground, borderColor: cardBorder }]}>
        <ThemedText type="defaultSemiBold" style={styles.eventName}>
          {item.eventName}
        </ThemedText>
        <ThemedText style={[styles.eventMeta, { color: mutedText }]}>{item.shortName ?? item.eventKey}</ThemedText>
        <ThemedText style={[styles.eventMeta, { color: mutedText }]}>Season {item.year} • Week {item.week}</ThemedText>
      </View>
    ),
    [cardBackground, cardBorder, mutedText]
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
        <FlatList
          data={events}
          keyExtractor={(item) => item.eventKey}
          renderItem={renderEvent}
          contentContainerStyle={events.length === 0 ? styles.emptyListContent : styles.listContent}
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
  eventName: {
    fontSize: 18,
  },
  eventMeta: {
    fontSize: 14,
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
});
