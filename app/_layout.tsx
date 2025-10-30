import * as NavigationBar from 'expo-navigation-bar'; // ✅ added
import * as SecureStore from 'expo-secure-store';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useRef } from 'react'; // ✅ keep this import
import { Platform } from 'react-native'; // ✅ fix: import Platform separately

import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, usePathname } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';

import { LANDSCAPE_DRAWER_ROUTE_PATHS } from '@/app/navigation';
import {
  lockOrientationAsync,
  OrientationLock,
  type OrientationLockValue,
} from '@/lib/screen-orientation';

import '@/db'; // Initialize the SQLite-backed storage on startup.
import { View } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';

WebBrowser.maybeCompleteAuthSession();

// Normalize the export shape expected by @supabase/auth-js when running in Expo.
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
  // ✅ Step 2 – make Android navigation bar translucent / overlay
  useEffect(() => {
    if (Platform.OS === 'android') {
      NavigationBar.setBackgroundColorAsync('transparent').catch(() => {});
      NavigationBar.setBehaviorAsync('overlay-swipe').catch(() => {});
    }
  }, []);

  return (
    <SafeAreaProvider>
      <ColorSchemeProvider>
        <ThemedRootLayout />
      </ColorSchemeProvider>
    </SafeAreaProvider>
  );
}

function ThemedRootLayout() {
  const colorScheme = useColorScheme();
  const insets = useSafeAreaInsets();

  return (
    <AuthProvider>
      <QueryProvider>
        <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
          <OrganizationProvider>
            <OrientationController />
              <View
                style={{
                  flex: 1,
                  paddingTop: insets.top,
                  paddingBottom: insets.bottom,
                  backgroundColor:
                    colorScheme === 'dark'
                      ? DarkTheme.colors.background
                      : DefaultTheme.colors.background,
                }}
              >
                <Stack screenOptions={{ headerShown: false }}>
                  <Stack.Screen name="(drawer)" />
                  <Stack.Screen name="auth/login" />
                </Stack>
              </View>
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
