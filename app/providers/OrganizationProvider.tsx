import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import type { Organization } from '@/db/schema';
import {
  getActiveOrganizationId,
  getOrganizationById,
  setActiveOrganization,
  subscribeToActiveOrganization,
} from '@/app/services/logged-in-organization';

interface OrganizationContextValue {
  selectedOrganization: Organization | null;
  setSelectedOrganization: (organization: Organization | null) => void;
}

const OrganizationContext = createContext<OrganizationContextValue | undefined>(undefined);

interface OrganizationProviderProps {
  children: ReactNode;
}

export function OrganizationProvider({ children }: OrganizationProviderProps) {
  const [selectedOrganization, setSelectedOrganizationState] = useState<Organization | null>(null);

  useEffect(() => {
    let isMounted = true;

    const initialOrganization = getOrganizationById(getActiveOrganizationId());
    setSelectedOrganizationState(initialOrganization);

    const unsubscribe = subscribeToActiveOrganization((organizationId) => {
      if (!isMounted) {
        return;
      }

      const organization = getOrganizationById(organizationId);
      setSelectedOrganizationState(organization);
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  const setSelectedOrganization = useCallback((organization: Organization | null) => {
    setSelectedOrganizationState(organization);
    setActiveOrganization(organization?.id ?? null);
  }, []);

  const value = useMemo(
    () => ({
      selectedOrganization,
      setSelectedOrganization,
    }),
    [selectedOrganization, setSelectedOrganization],
  );

  return <OrganizationContext.Provider value={value}>{children}</OrganizationContext.Provider>;
}

export function useOrganizationContext() {
  const context = useContext(OrganizationContext);
  if (!context) {
    throw new Error('useOrganizationContext must be used within an OrganizationProvider');
  }

  return context;
}
