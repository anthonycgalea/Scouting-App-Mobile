import { Pressable, StyleSheet, View } from 'react-native';

import { ScreenContainer } from '@/components/layout/ScreenContainer';
import { ThemedText } from '@/components/themed-text';
import {
  useColorScheme,
  useColorSchemePreference,
  useSetColorSchemePreference,
} from '@/hooks/use-color-scheme';

export function AppSettingsScreen() {
  const colorScheme = useColorScheme();
  const preference = useColorSchemePreference();
  const setPreference = useSetColorSchemePreference();

  return (
    <ScreenContainer>
      <ThemedText type="title">App Settings</ThemedText>
      <ThemedText>Choose how the app should look on your device.</ThemedText>

      <View style={styles.section}>
        <ThemedText style={styles.sectionLabel}>Appearance</ThemedText>
        <View style={styles.optionList}>
          <Pressable
            accessibilityRole="button"
            onPress={() => setPreference('system')}
            style={({ pressed }) => [
              styles.option,
              preference === 'system' ? styles.optionSelected : null,
              pressed ? styles.optionPressed : null,
            ]}
          >
            <ThemedText style={[styles.optionLabel, preference === 'system' ? styles.optionLabelSelected : null]}>
              Use device setting
            </ThemedText>
            <ThemedText style={styles.optionDescription}>
              Currently following {colorScheme === 'dark' ? 'dark' : 'light'} mode.
            </ThemedText>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={() => setPreference('light')}
            style={({ pressed }) => [
              styles.option,
              preference === 'light' ? styles.optionSelected : null,
              pressed ? styles.optionPressed : null,
            ]}
          >
            <ThemedText style={[styles.optionLabel, preference === 'light' ? styles.optionLabelSelected : null]}>
              Light mode
            </ThemedText>
            <ThemedText style={styles.optionDescription}>
              Bright background with high-contrast text and accents.
            </ThemedText>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={() => setPreference('dark')}
            style={({ pressed }) => [
              styles.option,
              preference === 'dark' ? styles.optionSelected : null,
              pressed ? styles.optionPressed : null,
            ]}
          >
            <ThemedText style={[styles.optionLabel, preference === 'dark' ? styles.optionLabelSelected : null]}>
              Dark mode
            </ThemedText>
            <ThemedText style={styles.optionDescription}>
              Dimmed surfaces designed for low-light environments.
            </ThemedText>
          </Pressable>
        </View>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  section: {
    marginTop: 16,
  },
  sectionLabel: {
    fontWeight: '600',
    marginBottom: 8,
  },
  optionList: {
    gap: 12,
  },
  option: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#CBD5F5',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  optionSelected: {
    borderColor: '#0a7ea4',
    backgroundColor: 'rgba(10, 126, 164, 0.08)',
  },
  optionPressed: {
    opacity: 0.85,
  },
  optionLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
  optionLabelSelected: {
    color: '#0a7ea4',
  },
  optionDescription: {
    marginTop: 4,
    fontSize: 14,
    lineHeight: 20,
    opacity: 0.8,
  },
});
