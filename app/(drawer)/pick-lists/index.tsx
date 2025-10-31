import { useEffect } from 'react';
import { useRouter } from 'expo-router';

import { PickListsScreen } from '@/app/screens';
import { ROUTES } from '@/constants/routes';
import { useIsTablet } from '@/hooks/use-is-tablet';
import { useOrganizationRole } from '@/hooks/use-organization-role';

export default function PickListsRoute() {
  const router = useRouter();
  const { canManagePickLists, isLoading } = useOrganizationRole();
  const isTablet = useIsTablet();

  useEffect(() => {
    if (isLoading) {
      return;
    }

    if (!canManagePickLists || !isTablet) {
      router.replace(ROUTES.pitScout);
    }
  }, [canManagePickLists, isLoading, isTablet, router]);

  if (isLoading || !canManagePickLists || !isTablet) {
    return null;
  }

  return <PickListsScreen />;
}
