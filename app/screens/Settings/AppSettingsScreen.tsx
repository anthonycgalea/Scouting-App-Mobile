import { useCallback, useState } from 'react';
import { Alert, ActivityIndicator, Pressable, StyleSheet, Switch, View } from 'react-native';

import { ScreenContainer } from '@/components/layout/ScreenContainer';
import { ThemedText } from '@/components/themed-text';
import { updateGeneralData, type UpdateGeneralDataResult } from '../../services/general-data';

export function AppSettingsScreen() {
  const [isUpdating, setIsUpdating] = useState(false);
  const [lastResult, setLastResult] = useState<UpdateGeneralDataResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleUpdatePress = useCallback(async () => {
    try {
      setIsUpdating(true);
      setErrorMessage(null);
      setLastResult(null);

      const result = await updateGeneralData();

      setLastResult(result);

      Alert.alert(
        'General data updated',
        `Teams updated: ${result.teams.created + result.teams.updated}. Events updated: ${result.events.created + result.events.updated}.`
      );
    } catch (error) {
      console.error('Failed to update general data', error);

      const message = error instanceof Error ? error.message : 'An unexpected error occurred.';
      setErrorMessage(message);
      Alert.alert('Update failed', message);
    } finally {
      setIsUpdating(false);
    }
  }, []);

  return (
    <ScreenContainer>
      <ThemedText type="title">App Settings</ThemedText>
      <ThemedText>Configure offline caching, data sync, and accessibility preferences.</ThemedText>
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
