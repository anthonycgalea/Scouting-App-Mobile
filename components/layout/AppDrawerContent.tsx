import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { DRAWER_ITEMS } from '@/app/navigation';
import { ROUTES } from '@/constants/routes';
import { ThemedText } from '@/components/themed-text';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuth } from '@/hooks/use-authentication';
import { useOrganization } from '@/hooks/use-organization';

export type DrawerContentProps = {
  state: {
    index: number;
    routes: { key: string; name: string }[];
  };
  navigation: {
    navigate: (name: string) => void;
    closeDrawer: () => void;
  };
};

export function AppDrawerContent({ state, navigation }: DrawerContentProps) {
  const { isAuthenticated, logout } = useAuth();
  const { selectedOrganization, setSelectedOrganization } = useOrganization();
  const colorScheme = useColorScheme();
  const activeRouteName = state.routes[state.index]?.name;
  const tint = Colors[colorScheme ?? 'light'].tint;

  const handleAuthAction = () => {
    navigation.closeDrawer();
    if (isAuthenticated) {
      logout();
      setSelectedOrganization(null);
    } else {
      router.push(ROUTES.login);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <ThemedText type="title">Scouting App</ThemedText>
        <ThemedText type="subtitle">
          {isAuthenticated
            ? selectedOrganization ?? 'No organization selected'
            : 'Browsing as guest'}
        </ThemedText>
      </View>
      <View style={styles.content}>
        {DRAWER_ITEMS.map((item) => {
          const isActive = activeRouteName === item.name;
          return (
            <Pressable
              key={item.name}
              accessibilityRole="button"
              accessibilityState={isActive ? { selected: true } : undefined}
              onPress={() => {
                navigation.navigate(item.name);
                navigation.closeDrawer();
              }}
              style={[styles.drawerItem, isActive && styles.drawerItemActive]}
            >
              <Ionicons name={item.icon} size={20} color={isActive ? tint : '#687076'} />
              <ThemedText type={isActive ? 'defaultSemiBold' : 'default'}>{item.title}</ThemedText>
            </Pressable>
          );
        })}
      </View>
      <Pressable
        accessibilityRole="button"
        onPress={handleAuthAction}
        style={styles.authButton}
      >
        <Ionicons
          name={isAuthenticated ? 'log-out-outline' : 'log-in-outline'}
          size={20}
          color={tint}
        />
        <ThemedText type="defaultSemiBold">{isAuthenticated ? 'Sign out' : 'Sign in'}</ThemedText>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 48,
    paddingBottom: 24,
    gap: 4,
  },
  content: {
    flex: 1,
    paddingHorizontal: 8,
  },
  drawerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 4,
  },
  drawerItemActive: {
    backgroundColor: '#e6f6fb',
  },
  authButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#d0d0d0',
  },
});
