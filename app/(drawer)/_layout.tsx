import Ionicons from '@expo/vector-icons/Ionicons';
import { Drawer } from 'expo-router/drawer';

import { AppDrawerContent, type DrawerContentProps } from '@/components/layout/AppDrawerContent';
import { useDrawerItems, useDrawerScreenOptions } from '@/app/navigation';

export default function DrawerLayout() {
  const screenOptions = useDrawerScreenOptions();
  const drawerItems = useDrawerItems();

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
