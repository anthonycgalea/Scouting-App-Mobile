import { useCallback, useState } from 'react';
import { Button, StyleSheet, TextInput } from 'react-native';

import { ScreenContainer } from '@/components/layout/ScreenContainer';
import { ThemedText } from '@/components/themed-text';
import { useAuth } from '@/hooks/use-authentication';
import { useOrganization } from '@/hooks/use-organization';

export function LoginScreen() {
  const { login, isAuthenticated } = useAuth();
  const { setSelectedOrganization } = useOrganization();
  const [organizationHint] = useState('OAuth Provider');

  const handleLogin = useCallback(() => {
    setSelectedOrganization('Team 2471');
    login();
  }, [login, setSelectedOrganization]);

  return (
    <ScreenContainer>
      <ThemedText type="title">Sign in</ThemedText>
      <ThemedText>
        Authentication is handled through OAuth. Tap the button below to start a mock OAuth flow and personalize the
        scouting tools, or continue exploring as a guest from the drawer menu.
      </ThemedText>
      <TextInput editable={false} style={styles.input} value={`Provider: ${organizationHint}`} />
      <Button title={isAuthenticated ? 'Continue' : 'Sign in with OAuth'} onPress={handleLogin} />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  input: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#999',
    padding: 12,
  },
});
