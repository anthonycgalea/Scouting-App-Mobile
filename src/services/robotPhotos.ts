import { Platform } from 'react-native';

import * as ImagePicker from 'expo-image-picker';
import {
  EncodingType,
  StorageAccessFramework,
  copyAsync,
  makeDirectoryAsync,
  readAsStringAsync,
  writeAsStringAsync,
} from 'expo-file-system';

import { getDbOrThrow, schema } from '@/db';
import { getActiveEvent } from '@/app/services/logged-in-event';
import { getWritableDirectory } from './photoStorage';

type FileSystemStorageLocation =
  | { kind: 'file'; directory: string }
  | { kind: 'saf'; directoryUri: string };

let cachedStorageLocation: FileSystemStorageLocation | null = null;
let storageResolutionPromise: Promise<FileSystemStorageLocation | null> | null = null;

async function resolveStorageLocation(): Promise<FileSystemStorageLocation | null> {
  if (cachedStorageLocation) {
    return cachedStorageLocation;
  }

  if (storageResolutionPromise) {
    return await storageResolutionPromise;
  }

  storageResolutionPromise = (async () => {
    const baseDirectory = await getWritableDirectory();

    if (baseDirectory) {
      const normalizedBaseDirectory = baseDirectory.endsWith('/')
        ? baseDirectory
        : `${baseDirectory}/`;

      return { kind: 'file', directory: `${normalizedBaseDirectory}robotPhotos` };
    }

    const canUseStorageAccessFramework =
      Platform.OS === 'android' &&
      StorageAccessFramework !== undefined &&
      typeof StorageAccessFramework.requestDirectoryPermissionsAsync === 'function';

    if (canUseStorageAccessFramework) {
      try {
        const permission = await StorageAccessFramework.requestDirectoryPermissionsAsync();

        if (!permission.granted || !permission.directoryUri) {
          return null;
        }

        return { kind: 'saf', directoryUri: permission.directoryUri };
      } catch (error) {
        console.warn('Failed to request storage permissions for robot photos.', error);
        return null;
      }
    }

    return null;
  })();

  try {
    const location = await storageResolutionPromise;

    if (location) {
      cachedStorageLocation = location;
    }

    return location;
  } finally {
    storageResolutionPromise = null;
  }
}

export async function ensureCameraPermission(): Promise<boolean> {
  const existingPermission = await ImagePicker.getCameraPermissionsAsync();

  if (existingPermission.granted) {
    return true;
  }

  const requestedPermission = await ImagePicker.requestCameraPermissionsAsync();

  return requestedPermission.granted;
}

export async function ensureRobotPhotoStoragePermission(): Promise<boolean> {
  const location = await resolveStorageLocation();

  if (location) {
    return true;
  }

  console.warn('Running inside Expo Go - using fallback URI for robot photo storage.');

  return Platform.OS === 'web';
}

export async function takeRobotPhoto(teamNumber: number): Promise<string | null> {
  const existingMediaLibraryPermission = await ImagePicker.getMediaLibraryPermissionsAsync();

  if (!existingMediaLibraryPermission.granted) {
    const requestedMediaLibraryPermission = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!requestedMediaLibraryPermission.granted) {
      console.warn('Media library permission is required to capture robot photos.');
      return null;
    }
  }

  const result = await ImagePicker.launchCameraAsync({
    quality: 0.8,
    base64: false,
  });

  if (result.canceled || !result.assets?.[0]?.uri) {
    return null;
  }

  const eventKey = getActiveEvent();

  if (!eventKey) {
    throw new Error('Cannot capture robot photo without an active event.');
  }

  const sourceUri = result.assets[0].uri;
  let destinationUri = sourceUri;
  const storageLocation = await resolveStorageLocation();

  if (!storageLocation) {
    console.warn('Running inside Expo Go - using fallback URI for robot photo storage.');
  } else {
    try {
      if (storageLocation.kind === 'file') {
        const targetDirectory = storageLocation.directory.endsWith('/')
          ? storageLocation.directory
          : `${storageLocation.directory}/`;

        await makeDirectoryAsync(storageLocation.directory, { intermediates: true });

        const filename = `${teamNumber}_${Date.now()}.jpg`;
        destinationUri = `${targetDirectory}${filename}`;

        await copyAsync({
          from: sourceUri,
          to: destinationUri,
        });
      } else {
        const fileName = `${teamNumber}_${Date.now()}`;
        const fileUri = await StorageAccessFramework.createFileAsync(
          storageLocation.directoryUri,
          fileName,
          'image/jpeg',
        );

        const fileContents = await readAsStringAsync(sourceUri, {
          encoding: EncodingType.Base64,
        });

        await writeAsStringAsync(fileUri, fileContents, {
          encoding: EncodingType.Base64,
        });

        destinationUri = fileUri;
      }
    } catch (error) {
      console.warn('Failed to persist robot photo to the local filesystem, falling back to source URI.', error);
      destinationUri = sourceUri;
    }
  }

  const db = getDbOrThrow();

  await db
    .insert(schema.robotPhotos)
    .values({
      eventKey,
      teamNumber,
      localUri: destinationUri,
      uploadPending: 1,
    })
    .run();

  return destinationUri;
}
