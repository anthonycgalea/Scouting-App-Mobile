import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
} from 'react';

import {
  AuthProvider as SupabaseAuthProvider,
  useAuth as useSupabaseAuth,
} from '@/src/hooks/useAuth';
import { runFullSync } from '@/app/services/full-sync';

interface AuthContextValue {
  isAuthenticated: boolean;
  isLoading: boolean;
  login: () => Promise<void>;
  logout: () => Promise<void>;
  displayName: string | null;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

function AuthContextBridge({ children }: AuthProviderProps) {
  const { user, isLoading, signInWithDiscord, signOut, displayName } = useSupabaseAuth();
  const lastSyncedUserIdRef = useRef<string | null>(null);

  const login = useCallback(async () => {
    await signInWithDiscord();
  }, [signInWithDiscord]);

  const logout = useCallback(async () => {
    await signOut();
  }, [signOut]);

  useEffect(() => {
    const userId = user?.id ?? null;

    if (!userId) {
      lastSyncedUserIdRef.current = null;
      return;
    }

    if (lastSyncedUserIdRef.current === userId) {
      return;
    }

    lastSyncedUserIdRef.current = userId;

    const syncData = async () => {
      try {
        await runFullSync();
      } catch (error) {
        console.error('Full data sync after sign-in failed', error);
      }
    };

    void syncData();
  }, [user]);

  const value = useMemo(
    () => ({
      isAuthenticated: Boolean(user),
      isLoading,
      login,
      logout,
      displayName,
    }),
    [displayName, isLoading, login, logout, user],
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
