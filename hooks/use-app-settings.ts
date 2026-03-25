import { useContext } from 'react';

import { AppSettingsContext } from '@/app/providers/AppSettingsProvider';

export function useLeftHandedMode() {
  const context = useContext(AppSettingsContext);

  if (!context) {
    return false;
  }

  return context.leftHandedMode;
}

export function useSetLeftHandedMode() {
  const context = useContext(AppSettingsContext);

  if (!context) {
    throw new Error('useSetLeftHandedMode must be used within an AppSettingsProvider.');
  }

  return context.setLeftHandedMode;
}
