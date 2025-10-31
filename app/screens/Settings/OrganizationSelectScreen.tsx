import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { eq } from 'drizzle-orm';

import { ScreenContainer } from '@/components/layout/ScreenContainer';
import { ThemedText } from '@/components/themed-text';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useOrganization } from '@/hooks/use-organization';
import { getDbOrThrow, schema } from '@/db';
import { refreshUserOrganizations } from '@/app/services/general-data';
import { syncDataWithServer } from '@/app/services/sync-data';
import { updateUserOrganizationSelection } from '@/app/services/api/user';
import type { SyncDataWithServerResult } from '@/app/services/sync-data';
import type { Organization } from '@/db/schema';
import type { UserOrganizationSelectionResponse } from '@/app/services/api/user';

interface UserOrganizationListItem {
  id: number;
  role: string | null;
  organization: Organization;
}

const extractOrganizationId = (
  response: UserOrganizationSelectionResponse | null | undefined,
): number => {
  const possibleValues = [response?.organizationId, response?.organization_id];

  for (const value of possibleValues) {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }

    if (typeof value === 'string') {
      const parsed = Number.parseInt(value, 10);

      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }

  throw new Error('Server response did not include a valid organization id.');
};

const showSyncSuccessAlert = (result: SyncDataWithServerResult) => {
  const eventInfoSummary = [
    `Match schedule: received ${result.eventInfo.matchSchedule.received}, created ${result.eventInfo.matchSchedule.created}, updated ${result.eventInfo.matchSchedule.updated}, removed ${result.eventInfo.matchSchedule.removed}`,
    `Team list: received ${result.eventInfo.teamEvents.received}, created ${result.eventInfo.teamEvents.created}, removed ${result.eventInfo.teamEvents.removed}`,
  ].join('\n');

  const alreadyScoutedSummary = `Already scouted updates: matches ${result.alreadyScoutedUpdated}, pit ${result.alreadyPitScoutedUpdated}`;
  const submissionSummary =
    `Submitted ${result.matchDataSent} match entries, ${result.pitDataSent} pit entries, ${result.prescoutDataSent} prescout entries, ${result.superScoutDataSent} SuperScout entries, and uploaded ${result.robotPhotosUploaded} robot photos.`;
  const superScoutSummary = `Super scout fields synced: ${result.superScoutFieldsSynced}`;
  const title = result.eventChanged ? 'Event synchronized' : 'Sync complete';
  const message = [
    `Event: ${result.eventCode}`,
    submissionSummary,
    superScoutSummary,
    eventInfoSummary,
    alreadyScoutedSummary,
  ].join('\n\n');

  Alert.alert(title, message);
};

export function OrganizationSelectScreen() {
  const { selectedOrganization, setSelectedOrganization } = useOrganization();
  const [userOrganizations, setUserOrganizations] = useState<UserOrganizationListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [pendingUserOrganizationId, setPendingUserOrganizationId] = useState<number | null>(null);
  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDarkMode = colorScheme === 'dark';
  const accentColor = '#0a7ea4';
  const optionBorderColor = isDarkMode ? '#3f3f46' : '#ccc';
  const optionBackgroundColor = isDarkMode ? 'rgba(255, 255, 255, 0.03)' : '#fff';
  const optionActiveBackgroundColor = isDarkMode ? 'rgba(10, 126, 164, 0.2)' : '#e6f6fb';
  const secondaryTextColor = isDarkMode ? '#94a3b8' : '#475569';

  const fetchUserOrganizations = useCallback(async () => {
    const db = getDbOrThrow();
    const rows = db
      .select({
        id: schema.userOrganizations.id,
        organizationId: schema.organizations.id,
        name: schema.organizations.name,
        teamNumber: schema.organizations.teamNumber,
        role: schema.userOrganizations.role,
      })
      .from(schema.userOrganizations)
      .innerJoin(
        schema.organizations,
        eq(schema.userOrganizations.organizationId, schema.organizations.id)
      )
      .all();

    return rows
      .map((row): UserOrganizationListItem => {
        const role =
          typeof row.role === 'string' && row.role.trim().length > 0
            ? row.role.trim().toUpperCase()
            : null;

        return {
          id: row.id,
          role,
          organization: {
            id: row.organizationId,
            name: row.name,
            teamNumber: row.teamNumber,
          },
        };
      })
      .filter((row) => row.role !== 'PENDING')
      .sort((a, b) => a.organization.teamNumber - b.organization.teamNumber);
  }, []);

  useFocusEffect(
    useCallback(() => {
      let isActive = true;

      const loadUserOrganizations = async () => {
        if (!isActive) {
          return;
        }

        setIsLoading(true);
        setErrorMessage(null);

        try {
          await refreshUserOrganizations();
        } catch (error) {
          console.error('Failed to refresh user organizations from API', error);
        }

        try {
          const items = await fetchUserOrganizations();
          if (!isActive) {
            return;
          }
          setUserOrganizations(items);
        } catch (error) {
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
        } finally {
          if (!isActive) {
            return;
          }
          setIsLoading(false);
        }
      };

      void loadUserOrganizations();

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

  const handleOrganizationPress = useCallback(
    async (item: UserOrganizationListItem) => {
      if (pendingUserOrganizationId !== null) {
        return;
      }

      if (selectedOrganization?.id === item.organization.id) {
        return;
      }

      setPendingUserOrganizationId(item.id);

      try {
        const response = await updateUserOrganizationSelection(item.id);
        const newOrganizationId = extractOrganizationId(response);
        const matchingOrganization = userOrganizations.find(
          (org) => org.organization.id === newOrganizationId,
        );

        if (!matchingOrganization) {
          throw new Error('Selected organization was not found locally. Sync general data and try again.');
        }

        setSelectedOrganization(matchingOrganization.organization);

        try {
          const syncResult = await syncDataWithServer(newOrganizationId);
          showSyncSuccessAlert(syncResult);
        } catch (syncError) {
          console.error('Failed to sync data with server after switching organization', syncError);
          Alert.alert(
            'Sync failed',
            syncError instanceof Error
              ? syncError.message
              : 'An unexpected error occurred while syncing data with the server.',
          );
        }
      } catch (error) {
        console.error('Failed to switch organization', error);
        Alert.alert(
          'Organization switch failed',
          error instanceof Error
            ? error.message
            : 'An unexpected error occurred while switching organizations.',
        );
      } finally {
        setPendingUserOrganizationId(null);
      }
    },
    [pendingUserOrganizationId, selectedOrganization, setSelectedOrganization, userOrganizations],
  );

  return (
    <ScreenContainer>
      <View style={styles.header}>
        <ThemedText type="title" style={styles.headerTitle}>
          Organization
        </ThemedText>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push('/(drawer)/organization-select/apply')}
          style={[styles.applyButton, { backgroundColor: accentColor }]}
        >
          <ThemedText style={styles.applyButtonText}>Apply to Organization</ThemedText>
        </Pressable>
      </View>
      <ThemedText>Select which team or organization you are scouting for.</ThemedText>
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator
            accessibilityLabel="Loading organizations"
            color={accentColor}
          />
          <ThemedText style={[styles.loadingText, { color: secondaryTextColor }]}>
            Loading organizations…
          </ThemedText>
        </View>
      ) : errorMessage ? (
        <View style={styles.errorContainer}>
          <ThemedText style={styles.errorText}>{errorMessage}</ThemedText>
        </View>
      ) : (
        <FlatList
          data={userOrganizations}
          extraData={selectedOrganization?.id}
          keyExtractor={(item) => `${item.id}`}
          renderItem={({ item }) => {
            const isActive = item.organization.id === selectedOrganization?.id;
            const isPending = item.id === pendingUserOrganizationId;
            const isDisabled = pendingUserOrganizationId !== null;

            return (
              <Pressable
                accessibilityState={{ selected: isActive, busy: isPending || undefined }}
                disabled={isDisabled}
                style={[
                  styles.option,
                  {
                    borderColor: optionBorderColor,
                    backgroundColor: optionBackgroundColor,
                  },
                  isActive && {
                    borderColor: accentColor,
                    backgroundColor: optionActiveBackgroundColor,
                  },
                  isDisabled && !isPending && styles.disabledOption,
                ]}
                onPress={() => handleOrganizationPress(item)}
              >
                <ThemedText type="defaultSemiBold">
                  Team {item.organization.teamNumber}
                </ThemedText>
                <ThemedText style={[styles.optionSubtitle, { color: secondaryTextColor }]}>
                  {item.organization.name}
                </ThemedText>
                {isPending ? (
                  <ActivityIndicator
                    accessibilityLabel="Switching organization"
                    color={accentColor}
                    style={styles.optionLoadingIndicator}
                  />
                ) : null}
              </Pressable>
            );
          }}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <ThemedText type="defaultSemiBold">No organizations available</ThemedText>
              <ThemedText style={[styles.emptyStateHint, { color: secondaryTextColor }]}>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    flexWrap: 'wrap',
    marginBottom: 12,
  },
  headerTitle: {
    flexShrink: 1,
  },
  applyButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  applyButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  option: {
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 8,
  },
  disabledOption: {
    opacity: 0.6,
  },
  optionSubtitle: {
    marginTop: 4,
  },
  optionLoadingIndicator: {
    marginTop: 12,
    alignSelf: 'flex-start',
  },
  loadingContainer: {
    marginTop: 24,
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {},
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
  emptyStateHint: {},
});
