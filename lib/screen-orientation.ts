import * as ScreenOrientation from 'expo-screen-orientation';

export const OrientationLock = {
  PORTRAIT_UP: ScreenOrientation.OrientationLock.PORTRAIT_UP,
  LANDSCAPE: ScreenOrientation.OrientationLock.LANDSCAPE,
} as const;

export type OrientationLockValue =
  (typeof OrientationLock)[keyof typeof OrientationLock];

/** Locks the screen orientation and logs what happens */
export async function lockOrientationAsync(lock: OrientationLockValue) {
  try {
    console.log(`Attempting to lock orientation to ${lock}...`);
    await ScreenOrientation.lockAsync(lock);

    // ✅ Immediately check the current orientation
    const current = await ScreenOrientation.getOrientationAsync();
    console.log(`✅ Locked to ${lock}, current orientation: ${current}`);

    // (optional) human-readable debug info
    if (current === ScreenOrientation.Orientation.PORTRAIT_UP) {
      console.warn('⚠️ Still in portrait — Android may have ignored the request.');
    }
  } catch (error) {
    console.warn('❌ Failed to lock screen orientation', error);
  }
}
