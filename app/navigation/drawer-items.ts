import Ionicons from '@expo/vector-icons/Ionicons';
import { useMemo } from 'react';
import type { ComponentProps } from 'react';

import { Colors } from '@/constants/theme';
import { ROUTES } from '@/constants/routes';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useIsTablet } from '@/hooks/use-is-tablet';

type IoniconName = ComponentProps<typeof Ionicons>['name'];

export type DrawerItem = {
  name: string;
  title: string;
  href: string;
  icon: IoniconName;
};

const BASE_DRAWER_ITEMS: DrawerItem[] = [
  { name: 'pit-scout/index', title: 'Pit Scout', href: ROUTES.pitScout, icon: 'build-outline' },
  { name: 'match-scout/index', title: 'Match Scout', href: ROUTES.matchScout, icon: 'trophy-outline' },
  { name: 'prescout/index', title: 'Prescout', href: ROUTES.prescout, icon: 'search-outline' },
  { name: 'robot-photos/index', title: 'Robot Photos', href: ROUTES.robotPhotos, icon: 'camera-outline' },
  { name: 'pick-lists/index', title: 'Pick Lists', href: ROUTES.pickLists, icon: 'list-outline' },
  { name: 'settings/index', title: 'App Settings', href: ROUTES.appSettings, icon: 'settings-outline' },
  {
    name: 'organization-select/index',
    title: 'Organization Select',
    href: ROUTES.organizationSelect,
    icon: 'people-outline',
  },
];

const TABLET_ONLY_DRAWER_ITEMS: DrawerItem[] = [
  {
    name: 'match-previews/index',
    title: 'Match Previews',
    href: ROUTES.matchPreviews,
    icon: 'newspaper-outline',
  },
  {
    name: 'super-scout/index',
    title: 'SuperScout',
    href: ROUTES.superScout,
    icon: 'analytics-outline',
  },
];

const LANDSCAPE_ROUTE_PREFIXES = TABLET_ONLY_DRAWER_ITEMS.map((item) => item.href);

export const LANDSCAPE_DRAWER_ROUTE_PATHS = new Set(LANDSCAPE_ROUTE_PREFIXES);

export function useDrawerItems() {
  const isTablet = useIsTablet();

  return useMemo(() => {
    if (!isTablet) {
      return BASE_DRAWER_ITEMS;
    }

    const items = [...BASE_DRAWER_ITEMS];
    const insertIndex = items.findIndex((item) => item.name === 'match-scout/index');

    const tabletItems = [...TABLET_ONLY_DRAWER_ITEMS];

    if (insertIndex >= 0) {
      items.splice(insertIndex + 1, 0, ...tabletItems);
    } else {
      items.push(...tabletItems);
    }

    return items;
  }, [isTablet]);
}

export function useDrawerScreenOptions() {
  const colorScheme = useColorScheme();
  const scheme = colorScheme;

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
