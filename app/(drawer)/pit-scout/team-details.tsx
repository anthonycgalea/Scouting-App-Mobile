import { Stack, useLocalSearchParams } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ScreenContainer } from '@/components/layout/ScreenContainer';
import { ThemedText } from '@/components/themed-text';
import { useThemeColor } from '@/hooks/use-theme-color';

export default function PitScoutTeamDetailsScreen() {
  const params = useLocalSearchParams<{ teamNumber?: string | string[]; teamName?: string | string[] }>();

  const teamNumber = Array.isArray(params.teamNumber) ? params.teamNumber[0] : params.teamNumber;
  const teamName = Array.isArray(params.teamName) ? params.teamName[0] : params.teamName;

  const headerTitle = [teamNumber, teamName].filter(Boolean).join(' - ') || 'Team';

  const primaryButtonBackground = useThemeColor({ light: '#2563EB', dark: '#1E3A8A' }, 'tint');
  const primaryButtonText = '#F8FAFC';
  const footerBackground = useThemeColor({ light: '#FFFFFF', dark: '#111827' }, 'background');
  const borderColor = useThemeColor({ light: 'rgba(15, 23, 42, 0.08)', dark: 'rgba(148, 163, 184, 0.25)' }, 'text');

  return (
    <ScreenContainer>
      <Stack.Screen options={{ title: headerTitle }} />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.flexSpacer} />
        <View style={[styles.footer, { backgroundColor: footerBackground, borderColor }]}>
          <Pressable
            accessibilityRole="button"
            style={({ pressed }) => [
              styles.submitButton,
              {
                backgroundColor: primaryButtonBackground,
                opacity: pressed ? 0.9 : 1,
              },
            ]}
          >
            <ThemedText type="defaultSemiBold" style={[styles.submitButtonText, { color: primaryButtonText }]}>
              Submit Pit Data
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
  submitButtonText: {
    fontSize: 18,
  },
});
