import type { Session, User } from '@supabase/supabase-js';
import * as Linking from 'expo-linking';
import * as SecureStore from 'expo-secure-store';
import * as WebBrowser from 'expo-web-browser'; // ✅ needed for Expo Go
WebBrowser.maybeCompleteAuthSession();

// eslint-disable-next-line import/first
import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
// eslint-disable-next-line import/first
import { supabase } from '../lib/supabase';


const SESSION_KEY = 'supabase.session';
const REFRESH_TOKEN_KEY = 'supabase.refresh_token';

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

async function restoreSession() {
  const storedSession = await SecureStore.getItemAsync(SESSION_KEY);
  const storedRefresh = await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
  if (!storedSession || !storedRefresh) return null;

  try {
    const parsed = JSON.parse(storedSession) as Session;
    const { data, error } = await supabase.auth.setSession({
      access_token: parsed.access_token,
      refresh_token: storedRefresh,
    });
    if (error) return null;
    return data.session;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Handle deep link callback (OAuth redirect)
  const handleUrl = useCallback(async ({ url }: { url: string }) => {
    const parsed = Linking.parse(url);
    if (parsed.path !== '--/auth' || !parsed.queryParams?.code) return;

    const code = String(parsed.queryParams.code);
    const { data, error } = await supabase.auth.exchangeCodeForSession({ code });
    if (!error && data.session) {
      await persistSession(data.session);
      setSession(data.session);
      setUser(data.session.user);
    }
  }, []);

  // Initialize and restore session
  useEffect(() => {
    const init = async () => {
      setIsLoading(true);
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        setSession(data.session);
        setUser(data.session.user);
        await persistSession(data.session);
      } else {
        const restored = await restoreSession();
        if (restored) {
          setSession(restored);
          setUser(restored.user);
        }
      }
      setIsLoading(false);
    };

    init();
    const { data: sub } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      persistSession(nextSession);
    });

    const listener = Linking.addEventListener('url', handleUrl);
    Linking.getInitialURL().then((url) => url && handleUrl({ url }));

    return () => {
      sub.subscription.unsubscribe();
      listener.remove();
    };
  }, [handleUrl]);

  // ✅ Discord OAuth flow (Expo Go compatible)
  const signInWithDiscord = useCallback(async () => {
    try {
      console.log('App redirect (Linking.createURL):', Linking.createURL('/auth'));
      const redirect = Linking.createURL('/--/auth');
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'discord',
        options: { redirectTo: redirect },
      });

      if (error) throw error;
      console.log('OAuth redirect URL:', data?.url); // 👈 paste this line here
      if (data?.url) {
        await WebBrowser.openAuthSessionAsync(data.url, redirect);
      }
    } catch (error) {
      console.warn('Discord sign-in failed:', error);
    }
  }, []);

  const signOut = useCallback(async () => {
    try {
      await supabase.auth.signOut();
    } finally {
      await persistSession(null);
      setSession(null);
      setUser(null);
    }
  }, []);

  const value = useMemo(
    () => ({ user, session, isLoading, signInWithDiscord, signOut }),
    [user, session, isLoading, signInWithDiscord, signOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
