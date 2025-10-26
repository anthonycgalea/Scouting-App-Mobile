import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { Text, View } from 'react-native';

export default function AuthRedirect() {
  const router = useRouter();

  useEffect(() => {
    // optional: go back or home once auth is complete
    const timeout = setTimeout(() => {
      router.replace('/'); // navigate home after a short delay
    }, 1000);

    return () => clearTimeout(timeout);
  }, [router]);

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <Text>Redirecting...</Text>
    </View>
  );
}
