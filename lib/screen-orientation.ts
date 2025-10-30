import { OrientationLock as ExpoOrientationLock } from 'expo-screen-orientation';
import { NativeModulesProxy } from 'expo-modules-core';

export const OrientationLock = {
  PORTRAIT_UP: ExpoOrientationLock.PORTRAIT_UP,
  LANDSCAPE: ExpoOrientationLock.LANDSCAPE,
} as const;

export type OrientationLockValue = (typeof OrientationLock)[keyof typeof OrientationLock];

const ExpoScreenOrientation =
  NativeModulesProxy?.ExpoScreenOrientation as
    | { lockAsync?: (orientation: OrientationLockValue) => Promise<void> }
    | undefined;

export async function lockOrientationAsync(lock: OrientationLockValue) {
  if (!ExpoScreenOrientation?.lockAsync) {
    const error = new Error('Screen orientation module is not available');
    console.warn(error.message);
    throw error;
  }

  try {
    await ExpoScreenOrientation.lockAsync(lock);
  } catch (error) {
    console.warn('Failed to lock screen orientation', error);
    throw error;
  }
}
