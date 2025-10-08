export const ROUTES = {
  login: '/auth/login' as const,
  pitScout: '/(drawer)/pit-scout' as const,
  matchScout: '/(drawer)/match-scout' as const,
  appSettings: '/(drawer)/settings' as const,
  userSettings: '/(drawer)/user-settings' as const,
  organizationSelect: '/(drawer)/organization-select' as const,
};

export type AppRoute = (typeof ROUTES)[keyof typeof ROUTES];
