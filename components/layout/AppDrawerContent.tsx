import Ionicons from '@expo/vector-icons/Ionicons';
import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import type { DrawerItem } from '@/app/navigation';
import { useDrawerItems } from '@/app/navigation';
import { syncDataWithServer } from '@/app/services/sync-data';
import { ThemedText } from '@/components/themed-text';
import { ROUTES } from '@/constants/routes';
import { Colors } from '@/constants/theme';
import type { Organization } from '@/db/schema';
import { useAuth } from '@/hooks/use-authentication';
import { useColorScheme } from '@/hooks/use-color-scheme';
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

function formatOrganizationLabel(organization: Organization) {
  return `Team ${organization.teamNumber} – ${organization.name}`;
}

export function AppDrawerContent({ state, navigation }: DrawerContentProps) {
  const { isAuthenticated, logout, displayName } = useAuth();
  const { selectedOrganization, setSelectedOrganization } = useOrganization();
  const queryClient = useQueryClient();
  const colorScheme = useColorScheme();
  const activeRouteName = state.routes[state.index]?.name;
  const drawerItems = useDrawerItems();
  const tint = Colors[colorScheme].tint;
  const inactiveIconColor = Colors[colorScheme].icon;
  const activeItemBackground =
    colorScheme === 'dark' ? 'rgba(255, 255, 255, 0.08)' : '#e6f6fb';
  const dividerColor = colorScheme === 'dark' ? '#2f3133' : '#d0d0d0';
  const [isSyncing, setIsSyncing] = useState(false);

  const settingsItemNames = new Set([
    'settings/index',
    'organization-select/index',
  ]);
  const primaryItems = drawerItems.filter((item) => !settingsItemNames.has(item.name));
  const settingsItems = drawerItems.filter((item) => settingsItemNames.has(item.name));

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

  const renderDrawerItem = (item: DrawerItem) => {
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

  const handleSyncPress = useCallback(async () => {
    if (isSyncing) {
      return;
    }

    if (!isAuthenticated) {
      Alert.alert('Sign in required', 'Sign in before syncing data with the server.');
      return;
    }

    if (!selectedOrganization) {
      Alert.alert(
        'Select an organization',
        'Choose the organization you are scouting for before syncing data.',
      );
      return;
    }

    setIsSyncing(true);

    try {
      const result = await syncDataWithServer(selectedOrganization.id);

      queryClient.invalidateQueries({ queryKey: ['picklists'] });
      queryClient.invalidateQueries({ queryKey: ['event-teams'] });

      navigation.closeDrawer();

      const activeDrawerItem = drawerItems.find(
        (item) => item.name === activeRouteName,
      );
      if (activeDrawerItem) {
        router.replace(activeDrawerItem.href);
      }

      const title = result.eventChanged ? 'Event synchronized' : 'Sync complete';
      const message = "Success";

      Alert.alert(title, message);
    } catch (error) {
      console.error('Failed to sync data with server', error);
      Alert.alert(
        'Sync failed',
        error instanceof Error
          ? error.message
          : 'An unexpected error occurred while syncing data with the server.',
      );
    } finally {
      setIsSyncing(false);
    }
  }, [
    activeRouteName,
    drawerItems,
    isAuthenticated,
    isSyncing,
    navigation,
    queryClient,
    selectedOrganization,
  ]);

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
            <Pressable
              accessibilityRole="button"
              accessibilityState={isSyncing ? { busy: true, disabled: true } : undefined}
              onPress={handleSyncPress}
              disabled={isSyncing}
              style={[styles.drawerItem, styles.syncButton, isSyncing && styles.disabledItem]}
            >
              <Ionicons
                name="cloud-upload-outline"
                size={20}
                color={tint}
              />
              <ThemedText type="defaultSemiBold">Sync Data with Server</ThemedText>
            </Pressable>
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
  syncButton: {
    marginBottom: 12,
  },
  authButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  disabledItem: {
    opacity: 0.5,
  },
});
