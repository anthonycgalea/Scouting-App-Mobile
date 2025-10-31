import { StyleSheet, View } from 'react-native';

import { ScreenContainer } from '@/components/layout/ScreenContainer';
import { ThemedText } from '@/components/themed-text';
import { useThemeColor } from '@/hooks/use-theme-color';

export function PickListsScreen() {
  const accentColor = useThemeColor({ light: '#0a7ea4', dark: '#7cd4f7' }, 'tint');
  const subtitleColor = useThemeColor(
    { light: 'rgba(15, 23, 42, 0.7)', dark: 'rgba(226, 232, 240, 0.7)' },
    'text',
  );

  return (
    <ScreenContainer>
      <View style={styles.content}>
        <ThemedText type="title" style={[styles.title, { color: accentColor }]}>
          Pick Lists
        </ThemedText>
        <ThemedText style={[styles.subtitle, { color: subtitleColor }]}>
          This feature is coming soon.
        </ThemedText>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    gap: 12,
  },
  title: {
    textAlign: 'center',
  },
  subtitle: {
    textAlign: 'center',
  },
});
