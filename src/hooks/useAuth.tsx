import type { Session, User } from '@supabase/supabase-js';
import * as Linking from 'expo-linking';
import * as SecureStore from 'expo-secure-store';
import * as WebBrowser from 'expo-web-browser'; // ✅ needed for Expo Go
console.log('🚀 Calling WebBrowser.maybeCompleteAuthSession()...');
const maybeCompletedAuthSession = WebBrowser.maybeCompleteAuthSession();
console.log('📬 WebBrowser.maybeCompleteAuthSession() result:', maybeCompletedAuthSession);

// eslint-disable-next-line import/first
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
// eslint-disable-next-line import/first
import { supabase } from '../lib/supabase';

// eslint-disable-next-line import/first
import { getUserInfo, setAuthorizationToken } from '@/app/services/api';


const SESSION_KEY = 'supabase.session';
const REFRESH_TOKEN_KEY = 'supabase.refresh_token';
const REFRESH_THRESHOLD_MS = 10 * 60 * 1000;

type AuthContextValue = {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  signInWithDiscord: () => Promise<void>;
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

      // 🔍 Add this:
      console.log(
        '✅ Stored session in SecureStore:',
        session.access_token?.slice(0, 12) + '...',
        '\nRefresh:',
        refreshTokenToStore ? 'yes' : 'no'
      );

      // Optional readback check
      const verify = await SecureStore.getItemAsync(SESSION_KEY);
      console.log('📦 Verify readback =', verify ? 'exists' : 'missing');
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
  console.log('🔑 restoreSession() - found:', {
    session: !!storedSession,
    refresh: !!storedRefresh,
  });
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
    if (!session || isRefreshingRef.current) {
      return;
    }

    isRefreshingRef.current = true;
    try {
      const storedRefresh = session.refresh_token ?? (await SecureStore.getItemAsync(REFRESH_TOKEN_KEY));
      if (!storedRefresh) {
        return;
      }

      const { data, error } = await supabase.auth.refreshSession({ refresh_token: storedRefresh });

      if (error || !data.session) {
        throw error ?? new Error('Unable to refresh session');
      }

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

      if (!currentSession?.expires_at) {
        return;
      }

      const expiresAtMs = currentSession.expires_at * 1000;
      const refreshAt = expiresAtMs - REFRESH_THRESHOLD_MS;
      const delay = refreshAt - Date.now();

      if (delay <= 0) {
        void refreshSession();
        return;
      }

      refreshTimeoutRef.current = setTimeout(() => {
        void refreshSession();
      }, delay);
    },
    [clearRefreshTimeout, refreshSession],
  );

  // Handle deep link callback (OAuth redirect)
  const handleUrl = useCallback(
    async ({ url }: { url: string }) => {
      console.log('🔔 handleUrl triggered with URL:', url);

      if (authFlowTimeoutRef.current) {
        console.log('🛑 Clearing pending auth timeout because deep link arrived.');
        clearTimeout(authFlowTimeoutRef.current);
        authFlowTimeoutRef.current = null;
      }

      try {
        const parsed = Linking.parse(url);
        const path = parsed.path?.replace(/^--\//, '').replace(/^\/+/, '');
        console.log('🧭 Parsed deep link path & params:', {
          path,
          queryParams: parsed.queryParams,
        });

        if (!path?.startsWith('auth') || !parsed.queryParams?.code) {
          console.log('🚫 handleUrl: no auth code found in query params.');
          return;
        }

        const code = String(parsed.queryParams.code);
        console.log('📨 Exchanging authorization code for session with Supabase...');

        const { data, error } = await supabase.auth.exchangeCodeForSession({ code });
        console.log('📬 exchangeCodeForSession response:', {
          hasSession: !!data?.session,
          error,
        });

        if (error) {
          console.warn('❌ exchangeCodeForSession encountered an error:', error);
          return;
        }

        if (data.session) {
          console.log('✅ Received session from Supabase. Persisting and updating state.');
          await persistSessionWithFallback(data.session);
          console.log('📦 persistSessionWithFallback complete');
          setSession(data.session);
          setUser(data.session.user);
        } else {
          console.log('⚠️ exchangeCodeForSession returned no session object.');
        }
      } catch (error) {
        console.error('⚠️ handleUrl threw an exception:', error);
      }
    },
    [],
  );


  // Initialize and restore session
  useEffect(() => {
    const init = async () => {
      setIsLoading(true);
      console.log('🚀 Initializing auth...');
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        console.log('🧠 Supabase already has active session');
        setSession(data.session);
        setUser(data.session.user);
        await persistSessionWithFallback(data.session);
      } else {
        console.log('🔄 No active session, trying restoreSession()');
        const restored = await restoreSession();
        if (restored) {
          setSession(restored.session);
          setUser(restored.session.user);
          await persistSession(restored.session, restored.refreshToken);
        } else {
          console.log('❌ No stored session found');
        }
      }
      setIsLoading(false);
    };

    init();
    const { data: sub } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      if (nextSession) {
        void persistSessionWithFallback(nextSession);
      } else {
        void persistSession(null);
      }
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

  useEffect(() => {
    scheduleSessionRefresh(session);

    return () => {
      clearRefreshTimeout();
    };
  }, [clearRefreshTimeout, scheduleSessionRefresh, session]);

  // ✅ Discord OAuth flow (Expo Go compatible)
  const signInWithDiscord = useCallback(async () => {
    console.log('🚀 Starting Discord OAuth sign-in flow...');

    try {
      const redirect = Linking.createURL('/auth');
      console.log('🔗 Computed redirect URL for Expo Linking:', redirect);

      console.log('📨 Calling supabase.auth.signInWithOAuth for Discord...');
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'discord',
        options: { redirectTo: redirect },
      });

      console.log('📬 signInWithOAuth response:', {
        hasData: !!data,
        authorizeUrl: data?.url,
        error,
      });

      if (error) {
        throw error;
      }

      if (!data?.url) {
        console.log('⚠️ Supabase did not return an authorize URL. Aborting browser launch.');
        return;
      }

      console.log('🌐 Opening WebBrowser auth session...');
      const authResult = await WebBrowser.openAuthSessionAsync(data.url, redirect);
      console.log('🏁 WebBrowser auth session closed with result:', authResult);

      if (authFlowTimeoutRef.current) {
        clearTimeout(authFlowTimeoutRef.current);
      }

      authFlowTimeoutRef.current = setTimeout(() => {
        console.log('⚠️ No auth callback received within 3 seconds after browser closed.');
        authFlowTimeoutRef.current = null;
      }, 3000);
    } catch (error) {
      console.error('❌ Discord sign-in failed with exception:', error);
    }
  }, []);


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
      signOut,
      displayName,
      refreshUserInfo,
      isFetchingUserInfo,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
