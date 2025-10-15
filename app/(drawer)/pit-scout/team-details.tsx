import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ScreenContainer } from '@/components/layout/ScreenContainer';
import { ThemedText } from '@/components/themed-text';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useOrganization } from '@/hooks/use-organization';
import { getDbOrThrow, schema } from '@/db';
import { getActiveEvent } from '@/app/services/logged-in-event';

export default function PitScoutTeamDetailsScreen() {
  const params = useLocalSearchParams<{ teamNumber?: string | string[]; teamName?: string | string[] }>();
  const router = useRouter();
  const { selectedOrganization } = useOrganization();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const teamNumber = Array.isArray(params.teamNumber) ? params.teamNumber[0] : params.teamNumber;
  const teamName = Array.isArray(params.teamName) ? params.teamName[0] : params.teamName;

  const headerTitle = [teamNumber, teamName].filter(Boolean).join(' - ') || 'Team';

  const primaryButtonBackground = useThemeColor({ light: '#2563EB', dark: '#1E3A8A' }, 'tint');
  const primaryButtonText = '#F8FAFC';
  const footerBackground = useThemeColor({ light: '#FFFFFF', dark: '#111827' }, 'background');
  const borderColor = useThemeColor({ light: 'rgba(15, 23, 42, 0.08)', dark: 'rgba(148, 163, 184, 0.25)' }, 'text');

  const handleSubmit = async () => {
    if (isSubmitting) {
      return;
    }

    const eventKey = getActiveEvent();

    if (!eventKey) {
      Alert.alert('Select an event', 'Choose an event before submitting pit scouting data.');
      return;
    }

    if (!selectedOrganization) {
      Alert.alert(
        'Select an organization',
        'Choose the organization you are scouting for before submitting pit scouting data.'
      );
      return;
    }

    const parsedTeamNumber = teamNumber ? Number.parseInt(teamNumber, 10) : Number.NaN;

    if (Number.isNaN(parsedTeamNumber)) {
      Alert.alert('Missing team number', 'A valid team number is required before submitting pit data.');
      return;
    }

    setIsSubmitting(true);

    try {
      const db = getDbOrThrow();

      await db
        .insert(schema.alreadyPitScouteds)
        .values({
          eventCode: eventKey,
          teamNumber: parsedTeamNumber,
          organizationId: selectedOrganization.id,
        })
        .onConflictDoNothing()
        .run();

      router.replace('/(drawer)/pit-scout');
    } catch (error) {
      console.error('Failed to mark pit scouting as completed', error);
      Alert.alert(
        'Unable to submit',
        error instanceof Error
          ? error.message
          : 'An unexpected error occurred while submitting pit scouting data.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ScreenContainer>
      <Stack.Screen options={{ title: headerTitle }} />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.flexSpacer} />
        <View style={[styles.footer, { backgroundColor: footerBackground, borderColor }]}> 
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              void handleSubmit();
            }}
            disabled={isSubmitting}
            style={({ pressed }) => [
              styles.submitButton,
              {
                backgroundColor: primaryButtonBackground,
                opacity: pressed && !isSubmitting ? 0.9 : 1,
              },
              isSubmitting ? styles.submitButtonDisabled : null,
            ]}
          >
            <ThemedText type="defaultSemiBold" style={[styles.submitButtonText, { color: primaryButtonText }]}> 
              {isSubmitting ? 'Submitting…' : 'Submit Pit Data'}
            </ThemedText>
          </Pressable>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    flexGrow: 1,
    padding: 24,
  },
  flexSpacer: {
    flex: 1,
  },
  footer: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
  },
  submitButton: {
    alignItems: 'center',
    borderRadius: 12,
    paddingVertical: 14,
  },
  submitButtonDisabled: {
    opacity: 0.7,
  },
  submitButtonText: {
    fontSize: 18,
  },
});
