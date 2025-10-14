import { createContext, ReactNode, useCallback, useContext, useMemo } from 'react';

import {
  AuthProvider as SupabaseAuthProvider,
  useAuth as useSupabaseAuth,
} from '@/src/hooks/useAuth';

interface AuthContextValue {
  isAuthenticated: boolean;
  isLoading: boolean;
  login: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

function AuthContextBridge({ children }: AuthProviderProps) {
  const { user, isLoading, signInWithDiscord, signOut } = useSupabaseAuth();

  const login = useCallback(async () => {
    await signInWithDiscord();
  }, [signInWithDiscord]);

  const logout = useCallback(async () => {
    await signOut();
  }, [signOut]);

  const value = useMemo(
    () => ({
      isAuthenticated: Boolean(user),
      isLoading,
      login,
      logout,
    }),
    [isLoading, login, logout, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function AuthProvider({ children }: AuthProviderProps) {
  return (
    <SupabaseAuthProvider>
      <AuthContextBridge>{children}</AuthContextBridge>
    </SupabaseAuthProvider>
  );
}

export function useAuthContext() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuthContext must be used within an AuthProvider');
  }

  return context;
}
