import {
  createDrawerNavigator,
  DrawerContentScrollView,
  DrawerItem,
  DrawerItemList,
} from '@react-navigation/drawer';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '../hooks/useAuth';
import LoginScreen from '../screens/LoginScreen';

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
  const { user, signOut, isLoading, displayName, isFetchingUserInfo } = useAuth();
  const insets = useSafeAreaInsets(); // ✅ safe area values

  return (
    <Drawer.Navigator
      screenOptions={{
        headerTitle: 'Scouting App',
        drawerType: 'front', // ✅ ensures drawer slides over content
        drawerStyle: {
          paddingBottom: insets.bottom, // ✅ keeps drawer background above nav bar
        },
      }}
      drawerContent={(props) => (
        <DrawerContentScrollView
          {...props}
          contentContainerStyle={{
            paddingTop: insets.top,
            // ✅ don't rely solely on paddingBottom — add a spacer below
          }}
        >
          <View style={styles.profileContainer}>
            {user ? (
              <>
                <Text style={styles.profileHeading}>Signed in as</Text>
                <Text style={styles.profileName}>
                  {displayName?.trim() || user.email || 'Unknown user'}
                </Text>
                {isFetchingUserInfo ? (
                  <Text style={styles.profileStatus}>Refreshing account details…</Text>
                ) : null}
              </>
            ) : (
              <Text style={styles.profileHeading}>You are browsing as a guest.</Text>
            )}
          </View>

          <DrawerItemList {...props} />

          {user ? (
            <DrawerItem
              disabled={isLoading}
              label={isLoading ? 'Signing out…' : 'Sign out'}
              onPress={async () => {
                try {
                  await signOut();
                } catch (error) {
                  const message =
                    error instanceof Error ? error.message : 'Failed to sign out.';
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

          {/* ✅ spacer ensures last item stays above system nav bar */}
          <View style={{ height: insets.bottom }} />
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
  profileContainer: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomColor: '#ececec',
    borderBottomWidth: StyleSheet.hairlineWidth,
    marginBottom: 8,
    gap: 4,
  },
  profileHeading: {
    fontSize: 14,
    color: '#555',
  },
  profileName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111',
  },
  profileStatus: {
    fontSize: 12,
    color: '#888',
  },
});
