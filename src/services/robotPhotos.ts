import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';

import { getDbOrThrow, schema } from '@/db';
import { getActiveEvent } from '@/app/services/logged-in-event';

export async function takeRobotPhoto(teamNumber: number): Promise<string | null> {
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
  // eslint-disable-next-line import/namespace -- documentDirectory is a valid runtime export from expo-file-system
  const baseDirectory = FileSystem.documentDirectory ?? FileSystem.cacheDirectory;

  if (!baseDirectory) {
    throw new Error('No writable directory available for storing robot photos.');
  }

  const directory = `${baseDirectory}robotPhotos`;

  await FileSystem.makeDirectoryAsync(directory, { intermediates: true });

  const destinationUri = `${directory}/${teamNumber}_${Date.now()}.jpg`;

  await FileSystem.copyAsync({
    from: sourceUri,
    to: destinationUri,
  });

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
