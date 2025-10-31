import { useEffect, useMemo, useState } from 'react';
import { eq } from 'drizzle-orm';

import { getDbOrThrow, schema } from '@/db';
import { useOrganization } from '@/hooks/use-organization';

function normalizeRole(role: unknown): string | null {
  if (typeof role !== 'string') {
    return null;
  }

  const trimmed = role.trim();
  if (trimmed.length === 0) {
    return null;
  }

  return trimmed.toUpperCase();
}

export function useOrganizationRole() {
  const { selectedOrganization } = useOrganization();
  const [role, setRole] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const loadRole = () => {
      setIsLoading(true);

      if (!selectedOrganization) {
        setRole(null);
        setIsLoading(false);
        return;
      }

      try {
        const db = getDbOrThrow();
        const records = db
          .select({ role: schema.userOrganizations.role })
          .from(schema.userOrganizations)
          .where(eq(schema.userOrganizations.organizationId, selectedOrganization.id))
          .limit(1)
          .all();

        if (!isMounted) {
          return;
        }

        setRole(normalizeRole(records[0]?.role));
        setIsLoading(false);
      } catch (error) {
        console.warn('Failed to read organization role from database', error);
        if (!isMounted) {
          return;
        }
        setRole(null);
        setIsLoading(false);
      }
    };

    loadRole();

    return () => {
      isMounted = false;
    };
  }, [selectedOrganization?.id]);

  const permissions = useMemo(
    () => ({
      role,
      canManagePickLists: role === 'ADMIN' || role === 'LEAD',
      isLoading,
    }),
    [isLoading, role],
  );

  return permissions;
}
