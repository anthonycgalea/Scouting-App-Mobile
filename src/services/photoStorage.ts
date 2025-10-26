import * as FileSystem from 'expo-file-system';

export async function getWritableDirectory(): Promise<string | null> {
  // eslint-disable-next-line import/namespace
  const documentDirectory = FileSystem.documentDirectory ?? null;
  // eslint-disable-next-line import/namespace
  const cacheDirectory = FileSystem.cacheDirectory ?? null;

  return documentDirectory ?? cacheDirectory ?? null;
}

function ensureTrailingSlash(path: string): string {
  return path.endsWith('/') ? path : `${path}/`;
}

export async function copyPhotoToWritableDirectory(uri: string): Promise<string> {
  const dir = await getWritableDirectory();

  if (dir) {
    const normalizedDir = ensureTrailingSlash(dir);
    const filename = uri.split('/').pop() ?? `photo_${Date.now()}.jpg`;
    const dest = `${normalizedDir}${filename}`;

    try {
      await FileSystem.copyAsync({ from: uri, to: dest });
      return dest;
    } catch (e) {
      console.warn('Failed to copy file:', e);
      return uri;
    }
  }

  console.warn('No writable directory available — running in Expo Go?');
  return uri;
}
