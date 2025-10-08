import { useOrganizationContext } from '@/app/providers/OrganizationProvider';

export function useOrganization() {
  return useOrganizationContext();
}
