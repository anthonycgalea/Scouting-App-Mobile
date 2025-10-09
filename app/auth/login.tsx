import { Redirect } from 'expo-router';

import { ROUTES } from '@/constants/routes';
import { LoginScreen } from '@/screens';
import { useAuth } from '@/hooks/use-authentication';

export default function LoginRoute() {
  const { isAuthenticated } = useAuth();

  if (isAuthenticated) {
    return <Redirect href={ROUTES.pitScout} />;
  }

  return <LoginScreen />;
}
