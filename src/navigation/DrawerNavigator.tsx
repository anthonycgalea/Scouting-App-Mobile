import { Alert, StyleSheet, Text, View } from 'react-native';
import { createDrawerNavigator, DrawerContentScrollView, DrawerItem, DrawerItemList } from '@react-navigation/drawer';

import LoginScreen from '../screens/LoginScreen';
import { useAuth } from '../hooks/useAuth';

const Drawer = createDrawerNavigator();

const HomeScreen = () => (
  <View style={styles.homeContainer}>
    <Text style={styles.homeTitle}>Guest Mode</Text>
    <Text style={styles.homeCopy}>
      Explore the app without signing in. Open the drawer to authenticate when you are ready.
    </Text>
  </View>
);

const DrawerNavigator = () => {
  const { user, signOut, isLoading } = useAuth();

  return (
    <Drawer.Navigator
      screenOptions={{
        headerTitle: 'Scouting App',
      }}
      drawerContent={(props) => (
        <DrawerContentScrollView {...props}>
          <DrawerItemList {...props} />
          {user ? (
            <DrawerItem
              disabled={isLoading}
              label={isLoading ? 'Signing out…' : 'Sign out'}
              onPress={async () => {
                try {
                  await signOut();
                } catch (error) {
                  const message = error instanceof Error ? error.message : 'Failed to sign out.';
                  Alert.alert('Sign out failed', message);
                }
              }}
            />
          ) : (
            <DrawerItem
              label="Sign in"
              onPress={() => props.navigation.navigate('Login' as never)}
            />
          )}
        </DrawerContentScrollView>
      )}
    >
      <Drawer.Screen name="Home" component={HomeScreen} />
      <Drawer.Screen
        name="Login"
        component={LoginScreen}
        options={{
          drawerItemStyle: { display: 'none' },
          title: 'Sign in',
        }}
      />
    </Drawer.Navigator>
  );
};

export default DrawerNavigator;

const styles = StyleSheet.create({
  homeContainer: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
    gap: 12,
  },
  homeTitle: {
    fontSize: 24,
    fontWeight: '700',
  },
  homeCopy: {
    fontSize: 16,
    color: '#4a4a4a',
  },
});
