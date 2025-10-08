import { ScreenContainer } from '@/components/layout/ScreenContainer';
import { ThemedText } from '@/components/themed-text';

export function MatchScoutScreen() {
  return (
    <ScreenContainer>
      <ThemedText type="title">Match Scouting</ThemedText>
      <ThemedText>
        Record match performance, scoring actions, and alliance notes in real time.
      </ThemedText>
    </ScreenContainer>
  );
}
