import { useCallback, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Alert, ActivityIndicator, Pressable, StyleSheet, Switch, View } from 'react-native';
import { useRouter } from 'expo-router';

import { ScreenContainer } from '@/components/layout/ScreenContainer';
import { ThemedText } from '@/components/themed-text';
import { updateGeneralData, type UpdateGeneralDataResult } from '../../services/general-data';
import { pingBackend } from '../../services/api/ping';
import { showToast } from '../../utils/showToast';
import { ROUTES } from '@/constants/routes';

export function AppSettingsScreen() {
  const [lastResult, setLastResult] = useState<UpdateGeneralDataResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [pingLabel, setPingLabel] = useState('Ping');
  const router = useRouter();

  const updateGeneralDataMutation = useMutation({
    mutationFn: updateGeneralData,
  });

  const pingMutation = useMutation({
    mutationFn: pingBackend,
  });

  const handleUpdatePress = useCallback(() => {
    setErrorMessage(null);
    setLastResult(null);

    updateGeneralDataMutation.mutate(undefined, {
      onSuccess: (result) => {
        setLastResult(result);
        const addedTeamsCount = result.teams.created;
        const teamLabel = addedTeamsCount === 1 ? 'team' : 'teams';
        showToast(`Added ${addedTeamsCount} new ${teamLabel}.`);
      },
      onError: (error) => {
        console.error('Failed to update general data', error);

        const message = error instanceof Error ? error.message : 'An unexpected error occurred.';
        setErrorMessage(message);
        Alert.alert('Update failed', message);
      },
    });
  }, [updateGeneralDataMutation]);

  const handlePingPress = useCallback(() => {
    pingMutation.mutate(undefined, {
      onSuccess: (data) => {
        setPingLabel(data.message);
      },
      onError: (error) => {
        console.error('Ping request failed', error);
        const message = error instanceof Error ? error.message : 'An unexpected error occurred.';
        Alert.alert('Ping failed', message);
      },
    });
  }, [pingMutation]);

  const isUpdating = updateGeneralDataMutation.isPending;
  const isPinging = pingMutation.isPending;

  const handleViewEventsPress = useCallback(() => {
    router.push(ROUTES.eventsBrowser);
  }, [router]);

  return (
    <ScreenContainer>
      <ThemedText type="title">App Settings</ThemedText>
      <ThemedText>Configure offline caching, data sync, and accessibility preferences.</ThemedText>
      <Pressable
        accessibilityRole="button"
        onPress={handleViewEventsPress}
        style={({ pressed }) => [styles.actionButton, styles.navigationButton, pressed ? styles.actionButtonPressed : null]}
        testID="view-events-button"
      >
        <ThemedText style={styles.actionButtonLabel}>View Events</ThemedText>
      </Pressable>
      <Switch value={true} disabled accessibilityLabel="Offline caching enabled" />
      <View style={styles.syncSection}>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: isUpdating }}
          disabled={isUpdating}
          onPress={handleUpdatePress}
          style={({ pressed }) => [
            styles.actionButton,
            pressed && !isUpdating ? styles.actionButtonPressed : null,
            isUpdating ? styles.actionButtonDisabled : null,
          ]}
          testID="update-general-data-button"
        >
          <ThemedText style={styles.actionButtonLabel}>
            {isUpdating ? 'Updating general data…' : 'Update general data'}
          </ThemedText>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: isPinging }}
          disabled={isPinging}
          onPress={handlePingPress}
          style={({ pressed }) => [
            styles.actionButton,
            styles.pingButton,
            pressed && !isPinging ? styles.actionButtonPressed : null,
            isPinging ? styles.actionButtonDisabled : null,
          ]}
          testID="ping-button"
        >
          <ThemedText style={styles.actionButtonLabel}>{pingLabel}</ThemedText>
        </Pressable>
        {isUpdating ? (
          <View style={styles.progressRow}>
            <ActivityIndicator accessibilityLabel="Updating general data" color="#0a7ea4" />
            <ThemedText style={styles.progressText}>Fetching the latest teams and events…</ThemedText>
          </View>
        ) : null}
        {lastResult ? (
          <View style={styles.statusBlock}>
            <ThemedText>
              Synced {lastResult.teams.created + lastResult.teams.updated} team records and{' '}
              {lastResult.events.created + lastResult.events.updated} events.
            </ThemedText>
          </View>
        ) : null}
        {errorMessage ? (
          <View style={styles.statusBlock}>
            <ThemedText style={styles.errorText}>{errorMessage}</ThemedText>
          </View>
        ) : null}
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  syncSection: {
    marginTop: 8,
  },
  actionButton: {
    backgroundColor: '#0a7ea4',
    borderRadius: 999,
    paddingVertical: 14,
    alignItems: 'center',
  },
  navigationButton: {
    alignSelf: 'flex-start',
    paddingHorizontal: 32,
  },
  pingButton: {
    marginTop: 12,
  },
  actionButtonPressed: {
    opacity: 0.85,
  },
  actionButtonDisabled: {
    backgroundColor: '#7fb7c8',
  },
  actionButtonLabel: {
    color: '#ffffff',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
  },
  progressText: {
    marginLeft: 8,
  },
  statusBlock: {
    marginTop: 12,
  },
  errorText: {
    color: '#d22f27',
  },
});
