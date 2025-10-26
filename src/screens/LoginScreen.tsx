import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { useAuth } from '../hooks/useAuth';

const LoginScreen = () => {
  const { signInWithDiscord, signInWithSlack, signInWithTeams, isLoading, displayName } = useAuth();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [activeProvider, setActiveProvider] = useState<'discord' | 'slack' | 'teams' | null>(null);

  const oauthOptions = useMemo(
    () => [
      {
        key: 'discord' as const,
        label: 'Sign in with Discord',
        start: signInWithDiscord,
        style: styles.discordButton,
      },
      {
        key: 'slack' as const,
        label: 'Sign in with Slack',
        start: signInWithSlack,
        style: styles.slackButton,
      },
      {
        key: 'teams' as const,
        label: 'Sign in with Teams',
        start: signInWithTeams,
        style: styles.teamsButton,
      },
    ],
    [signInWithDiscord, signInWithSlack, signInWithTeams],
  );

  const handleSignIn = async (
    providerKey: 'discord' | 'slack' | 'teams',
    start: () => Promise<void>,
    label: string,
  ) => {
    setErrorMessage(null);
    setActiveProvider(providerKey);
    try {
      await start();
    } catch (error) {
      const providerName = label.replace(/^Sign in with\s+/i, '');
      const message =
        error instanceof Error ? error.message : `Unable to start ${providerName} sign-in.`;
      setErrorMessage(message);
    } finally {
      setActiveProvider(null);
    }
  };

  const isBusy = isLoading || activeProvider !== null;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Sign in</Text>
      <Text style={styles.subtitle}>Connect your account to unlock syncing features.</Text>

      {oauthOptions.map(({ key, label, start, style }, index) => {
        const showSpinner =
          activeProvider === key || (isLoading && activeProvider === null && key === 'discord');
        const isDisabled = isBusy;
        const isLast = index === oauthOptions.length - 1;
        return (
          <Pressable
            key={key}
            style={({ pressed }) => [
              styles.button,
              style,
              pressed && styles.buttonPressed,
              (showSpinner || isBusy) && styles.buttonDisabled,
              isLast && styles.buttonLast,
            ]}
            accessibilityRole="button"
            disabled={isDisabled}
            onPress={() => handleSignIn(key, start, label)}
          >
            {showSpinner ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text style={styles.buttonLabel}>{label}</Text>
            )}
          </Pressable>
        );
      })}

      {displayName ? (
        <Text style={styles.userInfo}>Session display name: {displayName}</Text>
      ) : null}

      {errorMessage ? <Text style={styles.error}>{errorMessage}</Text> : null}
    </View>
  );
};

export default LoginScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
    backgroundColor: '#0b101b',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 12,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#d0d4ff',
    marginBottom: 24,
    textAlign: 'center',
  },
  button: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  buttonPressed: {
    opacity: 0.85,
  },
  buttonDisabled: {
    opacity: 0.65,
  },
  buttonLast: {
    marginBottom: 0,
  },
  discordButton: {
    backgroundColor: '#5865F2',
  },
  slackButton: {
    backgroundColor: '#4A154B',
  },
  teamsButton: {
    backgroundColor: '#464EB8',
  },
  buttonLabel: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  error: {
    color: '#ff8a80',
    marginTop: 16,
    textAlign: 'center',
  },
  userInfo: {
    color: '#c6f6d5',
    marginTop: 16,
    textAlign: 'center',
    fontWeight: '500',
  },
});
