import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';

import '@/db'; // Initialize the SQLite-backed storage on startup.

import { AuthProvider, OrganizationProvider, QueryProvider } from '@/app/providers';
import { useColorScheme } from '@/hooks/use-color-scheme';

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
