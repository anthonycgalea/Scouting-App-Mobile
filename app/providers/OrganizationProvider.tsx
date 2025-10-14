import { createContext, ReactNode, useContext, useMemo, useState } from 'react';

import type { Organization } from '@/db/schema';

interface OrganizationContextValue {
  selectedOrganization: Organization | null;
  setSelectedOrganization: (organization: Organization | null) => void;
}

const OrganizationContext = createContext<OrganizationContextValue | undefined>(undefined);

interface OrganizationProviderProps {
  children: ReactNode;
}

export function OrganizationProvider({ children }: OrganizationProviderProps) {
  const [selectedOrganization, setSelectedOrganization] = useState<Organization | null>(null);

  const value = useMemo(
    () => ({
      selectedOrganization,
      setSelectedOrganization,
    }),
    [selectedOrganization],
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
