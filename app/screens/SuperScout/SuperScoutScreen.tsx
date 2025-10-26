import { StyleSheet, View } from 'react-native';

import { ScreenContainer } from '@/components/layout/ScreenContainer';
import { ThemedText } from '@/components/themed-text';

export function SuperScoutScreen() {
  return (
    <ScreenContainer>
      <View style={styles.header}>
        <ThemedText type="title">SuperScout</ThemedText>
        <ThemedText type="subtitle">
          Capture alliance-wide performance insights while your team scouts each match.
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
