import * as SecureStore from 'expo-secure-store';
import * as WebBrowser from 'expo-web-browser';
WebBrowser.maybeCompleteAuthSession();
// eslint-disable-next-line import/first
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
// eslint-disable-next-line import/first
import { Stack } from 'expo-router';
// eslint-disable-next-line import/first
import { StatusBar } from 'expo-status-bar';
// eslint-disable-next-line import/first
import 'react-native-reanimated';

// eslint-disable-next-line import/first
import '@/db'; // Initialize the SQLite-backed storage on startup.

// Normalize the export shape expected by @supabase/auth-js when running in Expo.
// The library reaches for ExpoSecureStore.default, but the package only exposes
// named exports in ESM environments. Assigning the module object to its own
// default export ensures both patterns resolve to the same implementation.
(SecureStore as typeof SecureStore & { default?: typeof SecureStore }).default ??= SecureStore;

type ProvidersModule = typeof import('@/app/providers');
const { AuthProvider, OrganizationProvider, QueryProvider } =
  require('@/app/providers') as ProvidersModule;

type UseColorSchemeModule = typeof import('@/hooks/use-color-scheme');
const { useColorScheme } = require('@/hooks/use-color-scheme') as UseColorSchemeModule;

export const unstable_settings = {
  initialRouteName: '(drawer)',
};

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <AuthProvider>
      <QueryProvider>
        <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
          <OrganizationProvider>
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
