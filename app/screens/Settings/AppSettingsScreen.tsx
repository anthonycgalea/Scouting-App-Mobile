import { Switch } from 'react-native';

import { ScreenContainer } from '@/components/layout/ScreenContainer';
import { ThemedText } from '@/components/themed-text';

export function AppSettingsScreen() {
  return (
    <ScreenContainer>
      <ThemedText type="title">App Settings</ThemedText>
      <ThemedText>Configure offline caching, data sync, and accessibility preferences.</ThemedText>
      <Switch value={true} disabled accessibilityLabel="Offline caching enabled" />
    </ScreenContainer>
  );
}
