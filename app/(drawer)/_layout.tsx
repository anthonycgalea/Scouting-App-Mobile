import Ionicons from '@expo/vector-icons/Ionicons';
import { Drawer } from 'expo-router/drawer';

import { AppDrawerContent, type DrawerContentProps } from '@/components/layout/AppDrawerContent';
import { DRAWER_ITEMS, useDrawerScreenOptions } from '@/app/navigation/drawer-items';

export default function DrawerLayout() {
  const screenOptions = useDrawerScreenOptions();

  return (
    <Drawer drawerContent={(props: DrawerContentProps) => <AppDrawerContent {...props} />} screenOptions={screenOptions}>
      {DRAWER_ITEMS.map((item) => (
        <Drawer.Screen
          key={item.name}
          name={item.name as never}
          options={{
            title: item.title,
            drawerIcon: ({ color, size }: { color: string; size: number }) => (
              <Ionicons name={item.icon} size={size} color={color} />
            ),
            ...(item.options ?? {}),
          }}
        />
      ))}
    </Drawer>
  );
}
