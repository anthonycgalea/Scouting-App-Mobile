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
import type { Organization } from '@/db/schema';

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

function formatOrganizationLabel(organization: Organization) {
  return `Team ${organization.teamNumber} – ${organization.name}`;
}

export function AppDrawerContent({ state, navigation }: DrawerContentProps) {
  const { isAuthenticated, logout, displayName } = useAuth();
  const { selectedOrganization, setSelectedOrganization } = useOrganization();
  const colorScheme = useColorScheme();
  const activeRouteName = state.routes[state.index]?.name;
  const tint = Colors[colorScheme ?? 'light'].tint;
  const inactiveIconColor = Colors[colorScheme ?? 'light'].icon;
  const activeItemBackground =
    colorScheme === 'dark' ? 'rgba(255, 255, 255, 0.08)' : '#e6f6fb';
  const dividerColor = colorScheme === 'dark' ? '#2f3133' : '#d0d0d0';

  const settingsItemNames = new Set([
    'settings/index',
    'user-settings/index',
    'organization-select/index',
  ]);
  const primaryItems = DRAWER_ITEMS.filter((item) => !settingsItemNames.has(item.name));
  const settingsItems = DRAWER_ITEMS.filter((item) => settingsItemNames.has(item.name));

  const handleAuthAction = () => {
    navigation.closeDrawer();
    if (isAuthenticated) {
      logout();
      setSelectedOrganization(null);
    } else {
      router.push(ROUTES.login);
    }
  };

  const browsingLabel = `Browsing as ${displayName ?? 'guest'}`;
  const subtitle = isAuthenticated
    ? selectedOrganization
      ? formatOrganizationLabel(selectedOrganization)
      : browsingLabel
    : browsingLabel;

  const renderDrawerItem = (item: (typeof DRAWER_ITEMS)[number]) => {
    const isActive = activeRouteName === item.name;

    return (
      <Pressable
        key={item.name}
        accessibilityRole="button"
        accessibilityState={isActive ? { selected: true } : undefined}
        onPress={() => {
          router.navigate(item.href);
          navigation.closeDrawer();
        }}
        style={[
          styles.drawerItem,
          isActive && { backgroundColor: activeItemBackground },
        ]}
      >
        <Ionicons name={item.icon} size={20} color={isActive ? tint : inactiveIconColor} />
        <ThemedText type={isActive ? 'defaultSemiBold' : 'default'}>{item.title}</ThemedText>
      </Pressable>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <ThemedText type="title">Scouting App</ThemedText>
        <ThemedText type="subtitle">{subtitle}</ThemedText>
      </View>
      <View style={styles.content}>
        <View style={styles.primarySection}>{primaryItems.map(renderDrawerItem)}</View>
        {settingsItems.length > 0 ? (
          <View style={[styles.settingsSection, { borderTopColor: dividerColor }]}>
            {settingsItems.map(renderDrawerItem)}
          </View>
        ) : null}
      </View>
      <Pressable
        accessibilityRole="button"
        onPress={handleAuthAction}
        style={[styles.authButton, { borderTopColor: dividerColor }]}
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
  primarySection: {
    flexGrow: 1,
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
  settingsSection: {
    borderTopWidth: StyleSheet.hairlineWidth,
    marginTop: 12,
    paddingTop: 12,
  },
  authButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
