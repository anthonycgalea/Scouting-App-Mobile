import { useAuth } from '@/hooks/use-authentication';

import SupabaseLoginScreen from '@/src/screens/LoginScreen';

export function LoginScreen() {
  const { isAuthenticated } = useAuth();

  if (isAuthenticated) {
    return null;
  }

  return <SupabaseLoginScreen />;
}
