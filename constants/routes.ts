export const ROUTES = {
  login: '/auth/login' as const,
  pitScout: '/(drawer)/pit-scout' as const,
  matchScout: '/(drawer)/match-scout' as const,
  prescout: '/(drawer)/prescout' as const,
  robotPhotos: '/(drawer)/robot-photos' as const,
  appSettings: '/(drawer)/settings' as const,
  eventsBrowser: '/(drawer)/settings/events' as const,
  organizationSelect: '/(drawer)/organization-select' as const,
};

export type AppRoute = (typeof ROUTES)[keyof typeof ROUTES];
