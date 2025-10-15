import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';

import { ScreenContainer } from '@/components/layout/ScreenContainer';
import { ThemedText } from '@/components/themed-text';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { getDbOrThrow, schema } from '@/db';
import { applyToOrganization, fetchOrganizations, type OrganizationListItem } from '@/app/services/api';

const useUserOrganizationIds = () => {
  const loadOrganizationIds = useCallback(() => {
    const db = getDbOrThrow();
    const rows = db
      .select({ organizationId: schema.userOrganizations.organizationId })
      .from(schema.userOrganizations)
      .all();

    return new Set(rows.map((row) => row.organizationId));
  }, []);

  return loadOrganizationIds;
};

export function OrganizationApplyScreen() {
  const colorScheme = useColorScheme();
  const isDarkMode = colorScheme === 'dark';
  const accentColor = '#0a7ea4';
  const optionBorderColor = isDarkMode ? '#3f3f46' : '#ccc';
  const optionBackgroundColor = isDarkMode ? 'rgba(255, 255, 255, 0.03)' : '#fff';
  const optionActiveBackgroundColor = isDarkMode ? 'rgba(10, 126, 164, 0.2)' : '#e6f6fb';
  const secondaryTextColor = isDarkMode ? '#94a3b8' : '#475569';

  const router = useRouter();
  const getUserOrganizationIds = useUserOrganizationIds();

  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [organizations, setOrganizations] = useState<OrganizationListItem[]>([]);
  const [pendingOrganizationId, setPendingOrganizationId] = useState<number | null>(null);

  const loadOrganizations = useCallback(async () => {
    const userOrganizationIds = getUserOrganizationIds();
    const availableOrganizations = await fetchOrganizations();

    return availableOrganizations.filter((organization) => !userOrganizationIds.has(organization.id));
  }, [getUserOrganizationIds]);

  useFocusEffect(
    useCallback(() => {
      let isActive = true;

      setIsLoading(true);
      setErrorMessage(null);

      loadOrganizations()
        .then((items) => {
          if (!isActive) {
            return;
          }

          setOrganizations(items);
        })
        .catch((error) => {
          if (!isActive) {
            return;
          }

          console.error('Failed to load organizations for application', error);
          setOrganizations([]);
          setErrorMessage(
            error instanceof Error
              ? error.message
              : 'An unexpected error occurred while loading organizations.',
          );
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
    }, [loadOrganizations]),
  );

  const handleOrganizationApplyPress = useCallback(
    async (organization: OrganizationListItem) => {
      if (pendingOrganizationId !== null) {
        return;
      }

      setPendingOrganizationId(organization.id);

      try {
        await applyToOrganization(organization.id);
        Alert.alert(
          'Application sent',
          `Your request to join Team ${organization.teamNumber} has been submitted.`,
        );
        router.replace('/(drawer)/pit-scout');
      } catch (error) {
        console.error('Failed to apply to organization', error);
        Alert.alert(
          'Application failed',
          error instanceof Error
            ? error.message
            : 'An unexpected error occurred while submitting your application.',
        );
      } finally {
        setPendingOrganizationId(null);
      }
    },
    [pendingOrganizationId, router],
  );

  return (
    <ScreenContainer>
      <View style={styles.header}>
        <ThemedText type="title">Apply to an Organization</ThemedText>
      </View>
      <ThemedText>Choose an organization to request access to.</ThemedText>
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator accessibilityLabel="Loading organizations" color={accentColor} />
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
          data={organizations}
          keyExtractor={(item) => `${item.id}`}
          renderItem={({ item }) => {
            const isPending = pendingOrganizationId === item.id;
            const isDisabled = pendingOrganizationId !== null && !isPending;

            return (
              <Pressable
                accessibilityState={{ busy: isPending || undefined }}
                disabled={isDisabled}
                onPress={() => handleOrganizationApplyPress(item)}
                style={[
                  styles.option,
                  {
                    borderColor: optionBorderColor,
                    backgroundColor: optionBackgroundColor,
                  },
                  isPending && {
                    borderColor: accentColor,
                    backgroundColor: optionActiveBackgroundColor,
                  },
                  isDisabled && styles.disabledOption,
                ]}
              >
                <ThemedText type="defaultSemiBold">Team {item.teamNumber}</ThemedText>
                <ThemedText style={[styles.optionSubtitle, { color: secondaryTextColor }]}>
                  {item.name}
                </ThemedText>
                {isPending ? (
                  <ActivityIndicator
                    accessibilityLabel="Submitting application"
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
                All available organizations are already linked to your account.
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
  },
  option: {
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 16,
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
