import * as FileSystem from "expo-file-system";
import { NativeModules } from 'react-native';
console.log(Object.keys(NativeModules).filter(k => k.includes('FileSystem')));

/**
 * Determine a writable directory that actually exists.
 * Falls back to cacheDirectory if documentDirectory is unavailable.
 */
export async function getWritableDirectory(): Promise<string | null> {
  // These directories are injected by Expo at runtime but not typed in SDK 51+
  const documentDir = (FileSystem as any).documentDirectory as string | undefined;
  const cacheDir = (FileSystem as any).cacheDirectory as string | undefined;

  const writableDir = documentDir ?? cacheDir ?? null;

  if (writableDir) {
    try {
      await FileSystem.makeDirectoryAsync(writableDir, { intermediates: true });
      return ensureTrailingSlash(writableDir);
    } catch {
      return ensureTrailingSlash(writableDir);
    }
  }

  console.warn("No writable directory available — possibly running in Expo Go?");
  return null;
}

/** Ensure a trailing slash on directory paths. */
function ensureTrailingSlash(path: string): string {
  return path.endsWith("/") ? path : `${path}/`;
}

/**
 * Copy a photo into a writable sandboxed directory so it persists.
 * Returns the new URI (or the original if copy fails).
 */
export async function copyPhotoToWritableDirectory(uri: string): Promise<string> {
  const dir = await getWritableDirectory();
  if (!dir) {
    console.warn("No writable directory found — falling back to original URI.");
    return uri;
  }

  const filename = uri.split("/").pop() ?? `photo_${Date.now()}.jpg`;
  const destination = `${dir}${filename}`;

  try {
    await FileSystem.copyAsync({ from: uri, to: destination });
    return destination;
  } catch (error) {
    console.warn("Failed to copy file:", error);
    return uri;
  }
}
