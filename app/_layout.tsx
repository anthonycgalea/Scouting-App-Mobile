import * as SecureStore from 'expo-secure-store';
import * as WebBrowser from 'expo-web-browser';
WebBrowser.maybeCompleteAuthSession();
// eslint-disable-next-line import/first
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
// eslint-disable-next-line import/first
import { Stack, usePathname } from 'expo-router';
// eslint-disable-next-line import/first
import { StatusBar } from 'expo-status-bar';
// eslint-disable-next-line import/first
import 'react-native-reanimated';
// eslint-disable-next-line import/first
import { useEffect, useRef } from 'react';
// eslint-disable-next-line import/first
import { LANDSCAPE_DRAWER_ROUTE_PATHS } from '@/app/navigation';
// eslint-disable-next-line import/first
import {
  lockOrientationAsync,
  OrientationLock,
  type OrientationLockValue,
} from '@/lib/screen-orientation';

// eslint-disable-next-line import/first
import '@/db'; // Initialize the SQLite-backed storage on startup.

// Normalize the export shape expected by @supabase/auth-js when running in Expo.
// The library reaches for ExpoSecureStore.default, but the package only exposes
// named exports in ESM environments. Assigning the module object to its own
// default export ensures both patterns resolve to the same implementation.
(SecureStore as typeof SecureStore & { default?: typeof SecureStore }).default ??= SecureStore;

type ProvidersModule = typeof import('@/app/providers');
const { AuthProvider, OrganizationProvider, QueryProvider, ColorSchemeProvider } =
  require('@/app/providers') as ProvidersModule;

type UseColorSchemeModule = typeof import('@/hooks/use-color-scheme');
const { useColorScheme } = require('@/hooks/use-color-scheme') as UseColorSchemeModule;

export const unstable_settings = {
  initialRouteName: '(drawer)',
};

export default function RootLayout() {
  return (
    <ColorSchemeProvider>
      <ThemedRootLayout />
    </ColorSchemeProvider>
  );
}

function ThemedRootLayout() {
  const colorScheme = useColorScheme();

  return (
    <AuthProvider>
      <QueryProvider>
        <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
          <OrganizationProvider>
            <OrientationController />
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="(drawer)" />
              <Stack.Screen name="auth/login" />
            </Stack>
            <StatusBar style="auto" />
          </OrganizationProvider>
        </ThemeProvider>
      </QueryProvider>
    </AuthProvider>
  );
}

function OrientationController() {
  const pathname = usePathname();
  const lastOrientationLock = useRef<OrientationLockValue | null>(null);

  useEffect(() => {
    // Remove any leading /(drawer) or similar prefixes for comparison
    const normalize = (path: string) =>
      path.replace(/^\/?\(drawer\)/, '').replace(/\/index$/, '');

    const normalizedPath = normalize(pathname);
    const isLandscape = Array.from(LANDSCAPE_DRAWER_ROUTE_PATHS).some((route) =>
      normalizedPath.startsWith(normalize(route))
    );

    const desiredOrientation = isLandscape
      ? OrientationLock.LANDSCAPE
      : OrientationLock.PORTRAIT_UP;

    if (lastOrientationLock.current === desiredOrientation) return;
    lastOrientationLock.current = desiredOrientation;

    void lockOrientationAsync(desiredOrientation).catch(() => {
      lastOrientationLock.current = null;
    });
  }, [pathname]);

  return null;
}

