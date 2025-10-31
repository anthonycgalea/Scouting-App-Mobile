import { StyleSheet, Text, View } from 'react-native';

const PickListsScreen = () => (
  <View style={styles.container}>
    <Text style={styles.title}>Pick Lists</Text>
    <Text style={styles.subtitle}>This feature is coming soon.</Text>
  </View>
);

export default PickListsScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 16,
    color: '#4a4a4a',
    textAlign: 'center',
  },
});
