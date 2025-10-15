import { useCallback, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Alert, ActivityIndicator, Pressable, StyleSheet, Switch, View } from 'react-native';
import { useRouter } from 'expo-router';

import { ScreenContainer } from '@/components/layout/ScreenContainer';
import { ThemedText } from '@/components/themed-text';
import {
  updateGeneralData,
  type UpdateGeneralDataResult,
} from '../../services/general-data';
import {
  retrieveEventInfo,
  type RetrieveEventInfoResult,
} from '../../services/event-info';
import { pingBackend } from '../../services/api/ping';
import { showToast } from '../../utils/showToast';
import { ROUTES } from '@/constants/routes';

export function AppSettingsScreen() {
  const [lastResult, setLastResult] = useState<UpdateGeneralDataResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [eventInfoError, setEventInfoError] = useState<string | null>(null);
  const [pingLabel, setPingLabel] = useState('Ping');
  const [lastEventInfoResult, setLastEventInfoResult] = useState<RetrieveEventInfoResult | null>(null);
  const router = useRouter();

  const updateGeneralDataMutation = useMutation({
    mutationFn: updateGeneralData,
  });

  const pingMutation = useMutation({
    mutationFn: pingBackend,
  });

  const retrieveEventInfoMutation = useMutation({
    mutationFn: retrieveEventInfo,
  });

  const handleUpdatePress = useCallback(() => {
    setErrorMessage(null);
    setLastResult(null);

    updateGeneralDataMutation.mutate(undefined, {
      onSuccess: (result) => {
        setLastResult(result);
        const addedTeamsCount = result.teams.created;
        const teamLabel = addedTeamsCount === 1 ? 'team' : 'teams';
        const addedOrganizationsCount = result.organizations.created;
        const organizationLabel = addedOrganizationsCount === 1 ? 'organization' : 'organizations';
        const loggedInOrganizationMessage =
          result.loggedInOrganization.organizationId !== null
            ? 'Updated active organization selection.'
            : 'No active organization selected.';
        showToast(
          `Added ${addedTeamsCount} new ${teamLabel} and ${addedOrganizationsCount} new ${organizationLabel}. ${loggedInOrganizationMessage}`,
        );
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
  const isRetrievingEventInfo = retrieveEventInfoMutation.isPending;

  const handleViewEventsPress = useCallback(() => {
    router.push(ROUTES.eventsBrowser);
  }, [router]);

  const handleRetrieveEventInfoPress = useCallback(() => {
    setEventInfoError(null);
    setLastEventInfoResult(null);

    retrieveEventInfoMutation.mutate(undefined, {
      onSuccess: (result) => {
        setLastEventInfoResult(result);

        const { created, updated, removed, received } = result.matchSchedule;
        const scheduleSummary = `${received} matches (${created} new, ${updated} updated, ${removed} removed)`;
        const teamSummary = `${result.teamEvents.received} teams (${result.teamEvents.created} added, ${result.teamEvents.removed} removed)`;
        const scoutedSummary = `${result.alreadyScouted.received} already-scouted matches (${result.alreadyScouted.created} added)`;
        const pitSummary = `${result.alreadyPitScouted.received} already pit-scouted teams (${result.alreadyPitScouted.created} added)`;

        showToast(
          `Synced ${scheduleSummary}, ${teamSummary}, ${scoutedSummary}, and ${pitSummary} for ${result.eventCode}.`,
        );
      },
      onError: (error) => {
        console.error('Failed to retrieve event info', error);
        const message = error instanceof Error ? error.message : 'An unexpected error occurred.';
        setEventInfoError(message);
        Alert.alert('Retrieve event info failed', message);
      },
    });
  }, [retrieveEventInfoMutation]);

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
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: isRetrievingEventInfo }}
          disabled={isRetrievingEventInfo}
          onPress={handleRetrieveEventInfoPress}
          style={({ pressed }) => [
            styles.actionButton,
            styles.retrieveEventButton,
            pressed && !isRetrievingEventInfo ? styles.actionButtonPressed : null,
            isRetrievingEventInfo ? styles.actionButtonDisabled : null,
          ]}
          testID="retrieve-event-info-button"
        >
          <ThemedText style={styles.actionButtonLabel}>
            {isRetrievingEventInfo ? 'Retrieving event info…' : 'Retrieve event info'}
          </ThemedText>
        </Pressable>
        {isUpdating ? (
          <View style={styles.progressRow}>
            <ActivityIndicator accessibilityLabel="Updating general data" color="#0a7ea4" />
            <ThemedText style={styles.progressText}>
              Fetching the latest teams, events, organizations, user assignments, and logged-in organization…
            </ThemedText>
          </View>
        ) : null}
        {isRetrievingEventInfo ? (
          <View style={styles.progressRow}>
            <ActivityIndicator
              accessibilityLabel="Retrieving event information"
              color="#0a7ea4"
            />
            <ThemedText style={styles.progressText}>
              Downloading match schedule and team list for the active event…
            </ThemedText>
          </View>
        ) : null}
        {lastResult ? (
          <View style={styles.statusBlock}>
            <ThemedText>
              Synced {lastResult.teams.created + lastResult.teams.updated} team records,{' '}
              {lastResult.events.created + lastResult.events.updated} events,{' '}
              {lastResult.organizations.created + lastResult.organizations.updated} organizations, and{' '}
              {lastResult.userOrganizations.created + lastResult.userOrganizations.updated} user organization links.
              {'\n'}Logged-in organization ID:{' '}
              {lastResult.loggedInOrganization.organizationId ?? 'None'}
            </ThemedText>
          </View>
        ) : null}
        {lastEventInfoResult ? (
          <View style={styles.statusBlock}>
            <ThemedText>
              Match schedule: received {lastEventInfoResult.matchSchedule.received} matches ({
                lastEventInfoResult.matchSchedule.created
              }{' '}
              new, {lastEventInfoResult.matchSchedule.updated} updated,{' '}
              {lastEventInfoResult.matchSchedule.removed} removed).
              {'\n'}Team list: received {lastEventInfoResult.teamEvents.received} teams ({
                lastEventInfoResult.teamEvents.created
              }{' '}
              added, {lastEventInfoResult.teamEvents.removed} removed).
              {'\n'}Already scouted matches: received {lastEventInfoResult.alreadyScouted.received} matches ({
                lastEventInfoResult.alreadyScouted.created
              }{' '}
              added).
              {'\n'}Already pit-scouted teams: received {
                lastEventInfoResult.alreadyPitScouted.received
              }{' '}
              teams ({lastEventInfoResult.alreadyPitScouted.created} added).
            </ThemedText>
          </View>
        ) : null}
        {errorMessage ? (
          <View style={styles.statusBlock}>
            <ThemedText style={styles.errorText}>{errorMessage}</ThemedText>
          </View>
        ) : null}
        {eventInfoError ? (
          <View style={styles.statusBlock}>
            <ThemedText style={styles.errorText}>{eventInfoError}</ThemedText>
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
  retrieveEventButton: {
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
