import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { ReactNode } from 'react';
import * as Linking from 'expo-linking';
import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';
import type { Session, User } from '@supabase/supabase-js';

import { supabase } from '../lib/supabase';

const SESSION_KEY = 'supabase.session';
const REFRESH_TOKEN_KEY = 'supabase.refresh_token';

const expoConfig = Constants.expoConfig ?? Constants.manifest;
const extra = (expoConfig as typeof expoConfig & { extra?: Record<string, unknown> })?.extra ?? {};
const configuredRedirect = typeof extra?.supabaseRedirect === 'string' ? (extra.supabaseRedirect as string) : undefined;

const expectedRedirectPath = (() => {
  if (!configuredRedirect) {
    return 'auth';
  }

  const parsed = Linking.parse(configuredRedirect);
  return parsed.path ?? 'auth';
})();

const resolveRedirectUri = () => configuredRedirect ?? Linking.createURL('/auth');

type AuthContextValue = {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  signInWithDiscord: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

async function persistSession(session: Session | null) {
  try {
    if (session) {
      await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(session));
      if (session.refresh_token) {
        await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, session.refresh_token);
      }
    } else {
      await SecureStore.deleteItemAsync(SESSION_KEY);
      await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
    }
  } catch (error) {
    console.warn('Failed to persist Supabase session:', error);
  }
}

async function restoreStoredSession() {
  const storedSession = await SecureStore.getItemAsync(SESSION_KEY);
  const storedRefreshToken = await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);

  if (!storedSession || !storedRefreshToken) {
    return null;
  }

  try {
    const parsed = JSON.parse(storedSession) as Session;
    const { data, error } = await supabase.auth.setSession({
      access_token: parsed.access_token,
      refresh_token: storedRefreshToken,
    });

    if (error) {
      console.warn('Failed to restore Supabase session:', error.message);
      return null;
    }

    return data.session;
  } catch (error) {
    console.warn('Unable to parse stored Supabase session:', error);
    return null;
  }
}

type UrlEvent = { url: string };

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const pendingCode = useRef<string | null>(null);

  const handleAuthChange = useCallback(
    async (_event: string, nextSession: Session | null) => {
      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      await persistSession(nextSession);
      setIsLoading(false);
    },
    []
  );

  useEffect(() => {
    let isMounted = true;

    const initialize = async () => {
      setIsLoading(true);
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        if (!isMounted) return;
        setSession(data.session);
        setUser(data.session.user);
        await persistSession(data.session);
        setIsLoading(false);
        return;
      }

      const restored = await restoreStoredSession();
      if (restored && isMounted) {
        setSession(restored);
        setUser(restored.user);
      }

      if (isMounted) {
        setIsLoading(false);
      }
    };

    initialize();

    const { data: listener } = supabase.auth.onAuthStateChange(handleAuthChange);

    return () => {
      isMounted = false;
      listener?.subscription.unsubscribe();
    };
  }, [handleAuthChange]);

  const handleUrl = useCallback(
    async ({ url }: UrlEvent) => {
      const parsed = Linking.parse(url);
      if (!parsed?.path || parsed.path !== expectedRedirectPath) {
        return;
      }

      const code = parsed.queryParams?.code;
      if (typeof code !== 'string' || pendingCode.current === code) {
        return;
      }

      pendingCode.current = code;
      setIsSigningIn(true);
      const { error, data } = await supabase.auth.exchangeCodeForSession({ code });
      if (error) {
        console.warn('Failed to exchange OAuth code:', error.message);
      } else if (data.session) {
        await persistSession(data.session);
        setSession(data.session);
        setUser(data.session.user);
      }
      pendingCode.current = null;
      setIsSigningIn(false);
    },
    []
  );

  useEffect(() => {
    const subscription = Linking.addEventListener('url', handleUrl);
    Linking.getInitialURL().then((url) => {
      if (url) {
        handleUrl({ url });
      }
    });

    return () => {
      subscription.remove();
    };
  }, [handleUrl]);

  const signInWithDiscord = useCallback(async () => {
    setIsSigningIn(true);
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'discord',
        options: {
          redirectTo: resolveRedirectUri(),
        },
      });

      if (error) {
        throw error;
      }

      if (data?.url) {
        await Linking.openURL(data.url);
      }
    } catch (error) {
      console.warn('Discord sign-in failed:', error);
      throw error instanceof Error ? error : new Error('Discord sign-in failed');
    } finally {
      setIsSigningIn(false);
    }
  }, []);

  const signOut = useCallback(async () => {
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        throw error;
      }
    } catch (error) {
      console.warn('Sign-out failed:', error);
      throw error instanceof Error ? error : new Error('Sign-out failed');
    } finally {
      await persistSession(null);
      setSession(null);
      setUser(null);
      setIsLoading(false);
    }
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      session,
      isLoading: isLoading || isSigningIn,
      signInWithDiscord,
      signOut,
    }),
    [isLoading, isSigningIn, session, signInWithDiscord, signOut, user]
  );

  return createElement(AuthContext.Provider, { value }, children);
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
