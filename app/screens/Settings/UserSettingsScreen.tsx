import { Button } from 'react-native';

import { ScreenContainer } from '@/components/layout/ScreenContainer';
import { ThemedText } from '@/components/themed-text';
import { useAuth } from '@/hooks/use-authentication';

export function UserSettingsScreen() {
  const { logout } = useAuth();

  return (
    <ScreenContainer>
      <ThemedText type="title">User Settings</ThemedText>
      <ThemedText>Manage your profile, notification preferences, and authentication state.</ThemedText>
      <Button title="Sign out" onPress={logout} />
    </ScreenContainer>
  );
}
