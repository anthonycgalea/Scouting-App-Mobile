import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { eq } from 'drizzle-orm';

import { ScreenContainer } from '@/components/layout/ScreenContainer';
import { ThemedText } from '@/components/themed-text';
import { useOrganization } from '@/hooks/use-organization';
import { getDbOrThrow, schema } from '@/db';
import type { Organization } from '@/db/schema';

interface UserOrganizationListItem {
  id: number;
  organization: Organization;
}

export function OrganizationSelectScreen() {
  const { selectedOrganization, setSelectedOrganization } = useOrganization();
  const [userOrganizations, setUserOrganizations] = useState<UserOrganizationListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fetchUserOrganizations = useCallback(async () => {
    const db = getDbOrThrow();
    const rows = db
      .select({
        id: schema.userOrganizations.id,
        organizationId: schema.organizations.id,
        name: schema.organizations.name,
        teamNumber: schema.organizations.teamNumber,
      })
      .from(schema.userOrganizations)
      .innerJoin(
        schema.organizations,
        eq(schema.userOrganizations.organizationId, schema.organizations.id)
      )
      .all();

    return rows
      .map((row) => ({
        id: row.id,
        organization: {
          id: row.organizationId,
          name: row.name,
          teamNumber: row.teamNumber,
        },
      }))
      .sort((a, b) => a.organization.teamNumber - b.organization.teamNumber);
  }, []);

  useFocusEffect(
    useCallback(() => {
      let isActive = true;

      setIsLoading(true);
      setErrorMessage(null);

      fetchUserOrganizations()
        .then((items) => {
          if (!isActive) {
            return;
          }
          setUserOrganizations(items);
        })
        .catch((error) => {
          if (!isActive) {
            return;
          }
          console.error('Failed to load user organizations', error);
          const message =
            error instanceof Error
              ? error.message
              : 'An unexpected error occurred while loading organizations.';
          setErrorMessage(message);
          setUserOrganizations([]);
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
    }, [fetchUserOrganizations])
  );

  useEffect(() => {
    if (!selectedOrganization) {
      return;
    }

    const exists = userOrganizations.some(
      (item) => item.organization.id === selectedOrganization.id
    );

    if (!exists) {
      setSelectedOrganization(null);
    }
  }, [userOrganizations, selectedOrganization, setSelectedOrganization]);

  return (
    <ScreenContainer>
      <ThemedText type="title">Organization</ThemedText>
      <ThemedText>Select which team or organization you are scouting for.</ThemedText>
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator accessibilityLabel="Loading organizations" color="#0a7ea4" />
          <ThemedText style={styles.loadingText}>Loading organizations…</ThemedText>
        </View>
      ) : errorMessage ? (
        <View style={styles.errorContainer}>
          <ThemedText style={styles.errorText}>{errorMessage}</ThemedText>
        </View>
      ) : (
        <FlatList
          data={userOrganizations}
          keyExtractor={(item) => `${item.id}`}
          renderItem={({ item }) => {
            const isActive = item.organization.id === selectedOrganization?.id;

            return (
              <Pressable
                style={[styles.option, isActive ? styles.optionActive : undefined]}
                onPress={() => setSelectedOrganization(item.organization)}
              >
                <ThemedText type="defaultSemiBold">
                  Team {item.organization.teamNumber}
                </ThemedText>
                <ThemedText style={styles.optionSubtitle}>{item.organization.name}</ThemedText>
              </Pressable>
            );
          }}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <ThemedText type="defaultSemiBold">No organizations available</ThemedText>
              <ThemedText style={styles.emptyStateHint}>
                Sync general data from the App Settings screen to download your organizations.
              </ThemedText>
            </View>
          }
        />
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  option: {
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ccc',
    marginBottom: 8,
  },
  optionActive: {
    borderColor: '#0a7ea4',
    backgroundColor: '#e6f6fb',
  },
  optionSubtitle: {
    marginTop: 4,
    color: '#475569',
  },
  loadingContainer: {
    marginTop: 24,
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    color: '#475569',
  },
  errorContainer: {
    marginTop: 24,
    padding: 16,
    borderRadius: 8,
    backgroundColor: '#fee2e2',
    borderWidth: 1,
    borderColor: '#fca5a5',
  },
  errorText: {
    color: '#b91c1c',
  },
  emptyState: {
    marginTop: 24,
    gap: 8,
  },
  emptyStateHint: {
    color: '#475569',
  },
});
