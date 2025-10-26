import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useRef } from 'react';
import { usePathname } from 'expo-router';
import { Drawer } from 'expo-router/drawer';

import { AppDrawerContent, type DrawerContentProps } from '@/components/layout/AppDrawerContent';
import {
  useDrawerItems,
  useDrawerScreenOptions,
  LANDSCAPE_DRAWER_ROUTE_PATHS,
} from '@/app/navigation';
import { useIsTablet } from '@/hooks/use-is-tablet';
import {
  lockOrientationAsync,
  OrientationLock,
  type OrientationLockValue,
} from '@/lib/screen-orientation';

export default function DrawerLayout() {
  const screenOptions = useDrawerScreenOptions();
  const drawerItems = useDrawerItems();
  const pathname = usePathname();
  const isTablet = useIsTablet();
  const lastOrientationLock = useRef<OrientationLockValue | null>(null);

  useEffect(() => {
    if (!isTablet) {
      lastOrientationLock.current = null;
      return;
    }

    let shouldLockLandscape = false;

    if (pathname) {
      for (const route of LANDSCAPE_DRAWER_ROUTE_PATHS) {
        if (pathname.startsWith(route)) {
          shouldLockLandscape = true;
          break;
        }
      }
    }
    const desiredOrientation = shouldLockLandscape
      ? OrientationLock.LANDSCAPE
      : OrientationLock.PORTRAIT_UP;

    if (lastOrientationLock.current === desiredOrientation) {
      return;
    }

    lastOrientationLock.current = desiredOrientation;

    void lockOrientationAsync(desiredOrientation).catch(() => {
      lastOrientationLock.current = null;
    });
  }, [isTablet, pathname]);

  return (
    <Drawer drawerContent={(props: DrawerContentProps) => <AppDrawerContent {...props} />} screenOptions={screenOptions}>
      {drawerItems.map((item) => (
        <Drawer.Screen
          key={item.name}
          name={item.name as never}
          options={{
            title: item.title,
            drawerIcon: ({ color, size }: { color: string; size: number }) => (
              <Ionicons name={item.icon} size={size} color={color} />
            ),
          }}
        />
      ))}
    </Drawer>
  );
}
