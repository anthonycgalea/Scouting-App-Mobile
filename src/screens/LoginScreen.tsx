import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { useAuth } from '../hooks/useAuth';

const LoginScreen = () => {
  const { signInWithDiscord, isLoading, displayName } = useAuth();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSignIn = async () => {
    setErrorMessage(null);
    setIsSubmitting(true);
    try {
      await signInWithDiscord();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to start Discord sign-in.';
      setErrorMessage(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const showSpinner = isLoading || isSubmitting;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Sign in</Text>
      <Text style={styles.subtitle}>Connect your Discord account to unlock syncing features.</Text>

      <Pressable
        style={({ pressed }) => [
          styles.button,
          pressed && styles.buttonPressed,
          (showSpinner) && styles.buttonDisabled,
        ]}
        accessibilityRole="button"
        disabled={showSpinner}
        onPress={handleSignIn}
      >
        {showSpinner ? (
          <ActivityIndicator color="#ffffff" />
        ) : (
          <Text style={styles.buttonLabel}>Sign in with Discord</Text>
        )}
      </Pressable>

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
    backgroundColor: '#5865F2',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonPressed: {
    opacity: 0.85,
  },
  buttonDisabled: {
    opacity: 0.65,
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
