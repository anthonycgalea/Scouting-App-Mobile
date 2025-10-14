import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';

import { Colors } from '@/constants/theme';
import { ROUTES } from '@/constants/routes';
import { useColorScheme } from '@/hooks/use-color-scheme';

type IoniconName = ComponentProps<typeof Ionicons>['name'];

export const DRAWER_ITEMS: {
  name: string;
  title: string;
  href: string;
  icon: IoniconName;
}[] = [
  { name: 'pit-scout/index', title: 'Pit Scout', href: ROUTES.pitScout, icon: 'build-outline' },
  { name: 'match-scout/index', title: 'Match Scout', href: ROUTES.matchScout, icon: 'trophy-outline' },
  { name: 'prescout/index', title: 'Prescout', href: ROUTES['prescout'], icon: 'search-outline' },
  { name: 'settings/index', title: 'App Settings', href: ROUTES.appSettings, icon: 'settings-outline' },
  {
    name: 'user-settings/index',
    title: 'User Settings',
    href: ROUTES.userSettings,
    icon: 'person-circle-outline',
  },
  {
    name: 'organization-select/index',
    title: 'Organization Select',
    href: ROUTES.organizationSelect,
    icon: 'people-outline',
  },
];

export function useDrawerScreenOptions() {
  const colorScheme = useColorScheme();
  const scheme = colorScheme ?? 'light';

  return {
    drawerActiveTintColor: Colors[scheme].tint,
    headerTintColor: Colors[scheme].text,
    drawerPosition: 'left',
    swipeEnabled: true,
    drawerType: 'front',
    headerTitleAlign: 'left',
    drawerStyle: {
      width: 280,
    },
  } as const;
}
