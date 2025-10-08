import { Platform } from 'react-native';

const DEV_WEB_BASE_URL = 'http://localhost:5173';

/**
 * Returns the base API url when the app is running in a web browser.
 * In development we point to localhost to hit the dev server directly.
 */
const getWebBaseUrl = () => {
  if (__DEV__) {
    return DEV_WEB_BASE_URL;
  }

  return getWebProductionBaseUrl();
};

/**
 * Stub for retrieving the production API URL for the web build.
 * Replace the return value when the production endpoint is known.
 */
export const getWebProductionBaseUrl = () => {
  // TODO: configure the production API url once it is available.
  return 'https://api.production.example.com';
};

/**
 * Stub for retrieving the base API URL for native mobile builds.
 * This should be updated to point at the correct backend for mobile usage.
 */
export const getMobileBaseUrl = () => {
  // TODO: configure the mobile API url once it is available.
  return 'https://api.mobile.example.com';
};

/**
 * Resolve the base API url for the current platform/environment.
 */
export const getBaseApiUrl = () => {
  if (Platform.OS === 'web') {
    return getWebBaseUrl();
  }

  return getMobileBaseUrl();
};
