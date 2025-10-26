import { StyleSheet, View } from 'react-native';

import { ScreenContainer } from '@/components/layout/ScreenContainer';
import { ThemedText } from '@/components/themed-text';

export function MatchPreviewsScreen() {
  return (
    <ScreenContainer>
      <View style={styles.header}>
        <ThemedText type="title">Match Previews</ThemedText>
        <ThemedText type="subtitle">
          Review upcoming match details and data to prepare your scouting strategy.
        </ThemedText>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    gap: 8,
  },
});
