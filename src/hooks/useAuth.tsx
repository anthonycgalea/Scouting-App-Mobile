import { getUserInfo, setAuthorizationToken } from '@/app/services/api';
import type { Session, User } from '@supabase/supabase-js';
import * as AuthSession from 'expo-auth-session';
import * as Linking from 'expo-linking';
import * as SecureStore from 'expo-secure-store';
import * as WebBrowser from 'expo-web-browser';
import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Platform } from 'react-native';
import { supabase } from '../lib/supabase';

const SESSION_KEY = 'supabase.session';
const REFRESH_TOKEN_KEY = 'supabase.refresh_token';
const REFRESH_THRESHOLD_MS = 10 * 60 * 1000;

type AuthContextValue = {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  signInWithDiscord: () => Promise<void>;
  signInWithSlack: () => Promise<void>;
  signInWithTeams: () => Promise<void>;
  signOut: () => Promise<void>;
  displayName: string | null;
  refreshUserInfo: () => Promise<void>;
  isFetchingUserInfo: boolean;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

async function persistSession(session: Session | null, refreshTokenOverride?: string) {
  try {
    if (session) {
      await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(session));
      const refreshTokenToStore = refreshTokenOverride ?? session.refresh_token;
      if (refreshTokenToStore) {
        await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, refreshTokenToStore);
      }
    } else {
      await SecureStore.deleteItemAsync(SESSION_KEY);
      await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
    }
  } catch (error) {
    console.warn('Failed to persist Supabase session:', error);
  }
}

async function persistSessionWithFallback(session: Session) {
  const storedRefresh = session.refresh_token ?? (await SecureStore.getItemAsync(REFRESH_TOKEN_KEY));
  await persistSession(session, storedRefresh ?? undefined);
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
    if (error || !data.session) return null;
    const refreshToken = data.session.refresh_token ?? storedRefresh;
    return { session: data.session, refreshToken };
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [isFetchingUserInfo, setIsFetchingUserInfo] = useState(false);
  const refreshTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isRefreshingRef = useRef(false);
  const authFlowTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const assignmentsSyncInFlightRef = useRef(false);
  const lastAssignmentsSyncUserRef = useRef<string | null>(null);
  const assignmentsSyncSucceededRef = useRef(false);

  const clearRefreshTimeout = useCallback(() => {
    if (refreshTimeoutRef.current) {
      clearTimeout(refreshTimeoutRef.current);
      refreshTimeoutRef.current = null;
    }
  }, []);

  const refreshUserInfo = useCallback(async () => {
    if (!session?.access_token) {
      setDisplayName(null);
      return;
    }

    setIsFetchingUserInfo(true);
    try {
      const info = await getUserInfo();
      setDisplayName(info.display_name ?? null);
    } catch (error) {
      console.warn('Failed to fetch user info:', error);
    } finally {
      setIsFetchingUserInfo(false);
    }
  }, [session?.access_token]);

  const refreshSession = useCallback(async () => {
    if (!session || isRefreshingRef.current) return;

    isRefreshingRef.current = true;
    try {
      const storedRefresh = session.refresh_token ?? (await SecureStore.getItemAsync(REFRESH_TOKEN_KEY));
      if (!storedRefresh) return;

      const { data, error } = await supabase.auth.refreshSession({ refresh_token: storedRefresh });
      if (error || !data.session) throw error ?? new Error('Unable to refresh session');

      const nextRefreshToken = data.session.refresh_token ?? storedRefresh;
      await persistSession(data.session, nextRefreshToken);
      setSession(data.session);
      setUser(data.session.user);
    } catch (error) {
      console.warn('Failed to refresh Supabase session:', error);
      clearRefreshTimeout();
      await persistSession(null);
      setSession(null);
      setUser(null);
      setDisplayName(null);
    } finally {
      isRefreshingRef.current = false;
    }
  }, [clearRefreshTimeout, session]);

  const scheduleSessionRefresh = useCallback(
    (currentSession: Session | null) => {
      clearRefreshTimeout();
      if (!currentSession?.expires_at) return;
      const expiresAtMs = currentSession.expires_at * 1000;
      const refreshAt = expiresAtMs - REFRESH_THRESHOLD_MS;
      const delay = refreshAt - Date.now();

      if (delay <= 0) {
        void refreshSession();
        return;
      }

      refreshTimeoutRef.current = setTimeout(() => void refreshSession(), delay);
    },
    [clearRefreshTimeout, refreshSession],
  );

  // Deep link handling
  const handleUrl = useCallback(
    async ({ url }: { url: string }) => {
      try {
        const parsed = Linking.parse(url);
        const qp = parsed.queryParams ?? {};
        const access_token = qp.access_token as string | undefined;
        const refresh_token =
          (qp.refresh_token as string | undefined) ||
          (qp.provider_refresh_token as string | undefined);
        const code = qp.code as string | undefined;

        if (access_token) {
          const { data, error } = await supabase.auth.setSession({ access_token, refresh_token });
          if (error) throw error;
          if (data.session) {
            await persistSessionWithFallback(data.session);
            setSession(data.session);
            setUser(data.session.user);
          }
          return;
        }

        if (code) {
          const { data, error } = await supabase.auth.exchangeCodeForSession({ code });
          if (error) throw error;
          if (data.session) {
            await persistSessionWithFallback(data.session);
            setSession(data.session);
            setUser(data.session.user);
          }
        }
      } catch (error) {
        console.error('handleUrl error:', error);
      }
    },
    [],
  );

  // Session initialization
  useEffect(() => {
    const init = async () => {
      setIsLoading(true);
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        setSession(data.session);
        setUser(data.session.user);
        await persistSessionWithFallback(data.session);
      } else {
        const restored = await restoreSession();
        if (restored) {
          setSession(restored.session);
          setUser(restored.session.user);
          await persistSession(restored.session, restored.refreshToken);
        }
      }
      setIsLoading(false);
    };
    init();

    const { data: sub } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      if (nextSession) void persistSessionWithFallback(nextSession);
      else void persistSession(null);
    });

    const listener = Linking.addEventListener('url', handleUrl);
    Linking.getInitialURL().then((url) => url && handleUrl({ url }));

    return () => {
      sub.subscription.unsubscribe();
      listener.remove();
    };
  }, [handleUrl]);

  useEffect(() => {
    setAuthorizationToken(session?.access_token);
    if (!session?.access_token) {
      setDisplayName(null);
      return;
    }
    refreshUserInfo();
  }, [session?.access_token, refreshUserInfo]);

  // OAuth login flow
  type SupportedOAuthProvider = 'discord' | 'slack_oidc' | 'azure';

  const startOAuthFlow = useCallback(
    async (provider: SupportedOAuthProvider, providerDisplayName: string) => {
      try {
        const redirect = Platform.select({
          web: 'https://www.codystats.com/auth/callback',
          default: AuthSession.makeRedirectUri({
            scheme: 'codystats',
            path: 'auth',
            useProxy: false,
          }),
        });

        console.log(`🔗 Using redirect URI for ${providerDisplayName}:`, redirect);

        const { data, error } = await supabase.auth.signInWithOAuth({
          provider,
          options: { redirectTo: redirect },
        });
        if (error) throw error;
        if (!data?.url) return;

        const authResult = await WebBrowser.openAuthSessionAsync(data.url, redirect);

        // Direct access token flow (Expo Go)
        if (authResult.type === 'success' && authResult.url) {
          const hash = authResult.url.split('#')[1];
          const hashParams = new URLSearchParams(hash ?? '');
          const access_token = hashParams.get('access_token') ?? undefined;
          const refresh_token =
            hashParams.get('refresh_token') ?? hashParams.get('provider_refresh_token') ?? undefined;

          if (access_token) {
            const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
              access_token,
              refresh_token,
            });
            if (sessionError) throw sessionError;
            if (sessionData.session) {
              await persistSessionWithFallback(sessionData.session);
              setSession(sessionData.session);
              setUser(sessionData.session.user);
            }
            return;
          }
        }

        // Standalone: handled via deep link
        authFlowTimeoutRef.current = setTimeout(() => {
          console.log(`⌛ Waiting for ${providerDisplayName} deep link callback...`);
          authFlowTimeoutRef.current = null;
        }, 3000);
      } catch (error) {
        console.error(`${providerDisplayName} sign-in failed:`, error);
        throw error;
      }
    },
    [],
  );

  const signInWithDiscord = useCallback(async () => startOAuthFlow('discord', 'Discord'), [startOAuthFlow]);
  const signInWithSlack = useCallback(async () => startOAuthFlow('slack_oidc', 'Slack'), [startOAuthFlow]);
  const signInWithTeams = useCallback(async () => startOAuthFlow('azure', 'Teams'), [startOAuthFlow]);

  const signOut = useCallback(async () => {
    try {
      await supabase.auth.signOut();
    } finally {
      clearRefreshTimeout();
      await persistSession(null);
      setSession(null);
      setUser(null);
      setDisplayName(null);
    }
  }, [clearRefreshTimeout]);

  const value = useMemo(
    () => ({
      user,
      session,
      isLoading,
      signInWithDiscord,
      signInWithSlack,
      signInWithTeams,
      signOut,
      displayName,
      refreshUserInfo,
      isFetchingUserInfo,
    }),
    [
      user,
      session,
      isLoading,
      signInWithDiscord,
      signInWithSlack,
      signInWithTeams,
      signOut,
      displayName,
      refreshUserInfo,
      isFetchingUserInfo,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
