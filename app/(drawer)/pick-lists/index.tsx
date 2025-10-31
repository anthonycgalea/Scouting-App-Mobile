import { useEffect } from 'react';
import { useRouter } from 'expo-router';

import { PickListsScreen } from '@/app/screens';
import { ROUTES } from '@/constants/routes';
import { useOrganizationRole } from '@/hooks/use-organization-role';

export default function PickListsRoute() {
  const router = useRouter();
  const { canManagePickLists, isLoading } = useOrganizationRole();

  useEffect(() => {
    if (isLoading) {
      return;
    }

    if (!canManagePickLists) {
      router.replace(ROUTES.pitScout);
    }
  }, [canManagePickLists, isLoading, router]);

  if (isLoading || !canManagePickLists) {
    return null;
  }

  return <PickListsScreen />;
}
