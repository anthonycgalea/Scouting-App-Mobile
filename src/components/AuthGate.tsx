import { PropsWithChildren } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';

import { useAuth } from '../hooks/useAuth';

type AuthGateProps = PropsWithChildren<{ message?: string }>;

const AuthGate = ({ children, message }: AuthGateProps) => {
  const navigation = useNavigation();
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator />
      </View>
    );
  }

  if (!user) {
    return (
      <View style={styles.centered}>
        <Text style={styles.message}>{message ?? 'Sign in to access this feature.'}</Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => navigation.navigate('Login' as never)}
          style={({ pressed }) => [styles.loginButton, pressed && styles.loginButtonPressed]}
        >
          <Text style={styles.loginButtonLabel}>Go to sign in</Text>
        </Pressable>
      </View>
    );
  }

  return <>{children}</>;
};

export default AuthGate;

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  message: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 16,
    color: '#222222',
  },
  loginButton: {
    backgroundColor: '#5865F2',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 10,
  },
  loginButtonPressed: {
    opacity: 0.8,
  },
  loginButtonLabel: {
    color: '#ffffff',
    fontWeight: '600',
  },
});
