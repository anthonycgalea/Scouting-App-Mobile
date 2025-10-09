import { useOrganizationContext } from '@/providers/OrganizationProvider';

export function useOrganization() {
  return useOrganizationContext();
}
