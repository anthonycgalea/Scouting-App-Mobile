import { and, eq } from "drizzle-orm";
import * as FileSystem from "expo-file-system/legacy";
import * as ImagePicker from "expo-image-picker";
import * as MediaLibrary from "expo-media-library";
import { Platform } from "react-native";

import { extractRemoteUrlFromRobotPhotoResponse, uploadRobotPhoto } from "@/app/services/api/robot-photos";
import { getActiveEvent } from "@/app/services/logged-in-event";
import { getDbOrThrow, schema } from "@/db";
import { getWritableDirectory } from "./photoStorage";

type RobotPhotoUploadRecord = {
  id: number;
  eventKey: string;
  teamNumber: number;
  localUri: string;
};

type FileSystemStorageLocation = { kind: "file"; directory: string };

async function resolveStorageLocation(): Promise<FileSystemStorageLocation | null> {
  const baseDir = await getWritableDirectory();
  if (!baseDir) return null;

  const normalized = baseDir.endsWith("/") ? baseDir : `${baseDir}/`;
  return { kind: "file", directory: `${normalized}robotPhotos` };
}

/** Ensure the app has camera access */
export async function ensureCameraPermission(): Promise<boolean> {
  const existing = await ImagePicker.getCameraPermissionsAsync();
  if (existing.granted) return true;
  const requested = await ImagePicker.requestCameraPermissionsAsync();
  return requested.granted;
}

/** Ensure the app can write photos locally or to gallery (Android 13+ safe) */
export async function ensureRobotPhotoStoragePermission(): Promise<boolean> {
  if (Platform.OS === "ios") return true;

  const { status, canAskAgain } = await MediaLibrary.getPermissionsAsync();
  if (status === "granted") return true;

  if (canAskAgain) {
    const { status: newStatus } = await MediaLibrary.requestPermissionsAsync();
    if (newStatus === "granted") return true;
  }

  // fallback check: ensure sandbox writable
  const dir = FileSystem.documentDirectory ?? FileSystem.cacheDirectory;
  if (dir) {
    try {
      await FileSystem.writeAsStringAsync(`${dir}perm_test.txt`, "ok");
      await FileSystem.deleteAsync(`${dir}perm_test.txt`, { idempotent: true });
      return true;
    } catch {
      // ignore
    }
  }
  return false;
}

/** Take and persist a robot photo */
export async function takeRobotPhoto(teamNumber: number): Promise<string | null> {
  const result = await ImagePicker.launchCameraAsync({
    quality: 0.8,
    base64: false,
  });

  if (result.canceled || !result.assets?.[0]?.uri) return null;

  const eventKey = getActiveEvent();
  if (!eventKey) throw new Error("Cannot capture robot photo without an active event.");

  const sourceUri = result.assets[0].uri;
  let destinationUri = sourceUri;
  const storage = await resolveStorageLocation();

  if (storage) {
    try {
      await FileSystem.makeDirectoryAsync(storage.directory, { intermediates: true });
      const filename = `${teamNumber}_${Date.now()}.jpg`;
      const targetUri = `${storage.directory}/${filename}`;
      await FileSystem.copyAsync({ from: sourceUri, to: targetUri });
      destinationUri = targetUri;
    } catch (err) {
      console.warn("Failed to persist robot photo locally, falling back to cache:", err);
      destinationUri = sourceUri;
    }
  } else {
    console.warn("No writable directory available — using fallback URI for robot photo storage.");
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

  const [inserted] = db
    .select({
      id: schema.robotPhotos.id,
      eventKey: schema.robotPhotos.eventKey,
      teamNumber: schema.robotPhotos.teamNumber,
      localUri: schema.robotPhotos.localUri,
    })
    .from(schema.robotPhotos)
    .where(
      and(
        eq(schema.robotPhotos.eventKey, eventKey),
        eq(schema.robotPhotos.teamNumber, teamNumber),
        eq(schema.robotPhotos.localUri, destinationUri),
      ),
    )
    .all();

  if (inserted) {
    await tryUploadRobotPhotoRecord(inserted);
  }

  return destinationUri;
}

/** Upload any pending local photo records */
export async function tryUploadRobotPhotoRecord(
  record: RobotPhotoUploadRecord,
  description?: string | null,
): Promise<boolean> {
  const db = getDbOrThrow();

  try {
    const fileInfo = await FileSystem.getInfoAsync(record.localUri);

    if (!fileInfo.exists) {
      console.warn(
        "Robot photo not found on device. Marking upload as complete without remote copy.",
        record.localUri,
      );
      await db
        .update(schema.robotPhotos)
        .set({ uploadPending: 0 })
        .where(eq(schema.robotPhotos.id, record.id))
        .run();
      return false;
    }

    const response = await uploadRobotPhoto(
      record.teamNumber,
      record.localUri,
      description ?? undefined,
    );

    const remoteUrl = extractRemoteUrlFromRobotPhotoResponse(response);

    await db
      .update(schema.robotPhotos)
      .set({
        remoteUrl: remoteUrl ?? null,
        uploadPending: 0,
      })
      .where(eq(schema.robotPhotos.id, record.id))
      .run();

    return true;
  } catch (error) {
    console.warn("Failed to upload robot photo. Will retry during sync.", error);
    return false;
  }
}
