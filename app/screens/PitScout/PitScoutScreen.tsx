import { ScreenContainer } from '@/components/layout/ScreenContainer';
import { ThemedText } from '@/components/themed-text';

export function PitScoutScreen() {
  return (
    <ScreenContainer>
      <ThemedText type="title">Pit Scouting</ThemedText>
      <ThemedText>
        Capture robot configurations, drivetrain specifications, and pre-match notes while visiting the pit.
      </ThemedText>
    </ScreenContainer>
  );
}
