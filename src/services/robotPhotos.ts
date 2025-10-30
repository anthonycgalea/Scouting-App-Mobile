import * as FileSystem from "expo-file-system";
import * as ImagePicker from "expo-image-picker";
import * as MediaLibrary from "expo-media-library";
import { Platform } from "react-native";
import { and, eq } from "drizzle-orm";

import { uploadRobotPhoto, extractRemoteUrlFromRobotPhotoResponse } from "@/app/services/api/robot-photos";
import { getActiveEvent } from "@/app/services/logged-in-event";
import { getDbOrThrow, schema } from "@/db";
import { getWritableDirectory } from "./photoStorage";

type FileSystemStorageLocation = { kind: "file"; directory: string };

type RobotPhotoUploadRecord = {
  id: number;
  eventKey: string;
  teamNumber: number;
  localUri: string;
};

/**
 * Resolve a local writable directory for robot photo storage.
 * SAF is no longer supported in Expo SDK 54, so we only use app sandbox.
 */
async function resolveStorageLocation(): Promise<FileSystemStorageLocation | null> {
  const baseDirectory = await getWritableDirectory();
  if (baseDirectory) {
    const normalized = baseDirectory.endsWith("/") ? baseDirectory : `${baseDirectory}/`;
    return { kind: "file", directory: `${normalized}robotPhotos` };
  }
  return null;
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
  // iOS and Android < 13 don’t need explicit storage permission for sandbox writes
  if (Platform.OS === "ios") return true;

  try {
    const { status, canAskAgain, accessPrivileges } =
      await MediaLibrary.getPermissionsAsync();

    // ✅ treat "limited" or "all" access as sufficient
    if (status === "granted" || status === "limited" || accessPrivileges === "all") {
      return true;
    }

    // If we can still ask, request again
    if (canAskAgain) {
      const { status: newStatus, accessPrivileges: newPrivs } =
        await MediaLibrary.requestPermissionsAsync();

      if (
        newStatus === "granted" ||
        newStatus === "limited" ||
        newPrivs === "all"
      ) {
        return true;
      }
    }

    // 🧠 fallback: internal sandbox (always writable)
    const fs: any = FileSystem as any;
    const dir = fs.documentDirectory ?? fs.cacheDirectory;
    if (dir) {
      try {
        await FileSystem.writeAsStringAsync(`${dir}perm_test.txt`, "ok");
        await FileSystem.deleteAsync(`${dir}perm_test.txt`, { idempotent: true });
        return true;
      } catch {
        // ignore sandbox write failure
      }
    }

    console.warn("Storage permission denied or limited beyond app sandbox.");
    return false;
  } catch (error) {
    console.error("Error requesting media permissions:", error);
    return false;
  }
}

/** Capture and persist a robot photo */
export async function takeRobotPhoto(teamNumber: number): Promise<string | null> {
  const existingLibPerm = await ImagePicker.getMediaLibraryPermissionsAsync();
  if (!existingLibPerm.granted) {
    const requested = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!requested.granted) {
      console.warn("Media library permission is required to capture robot photos.");
      return null;
    }
  }

  const result = await ImagePicker.launchCameraAsync({
    quality: 0.8,
    base64: false,
  });

  if (result.canceled || !result.assets?.[0]?.uri) return null;

  const eventKey = getActiveEvent();
  if (!eventKey) throw new Error("Cannot capture robot photo without an active event.");

  const sourceUri = result.assets[0].uri;
  let destinationUri = sourceUri;
  const storageLocation = await resolveStorageLocation();

  if (!storageLocation) {
    console.warn("No writable directory available — using fallback URI for robot photo storage.");
  } else {
    try {
      const targetDir = storageLocation.directory.endsWith("/")
        ? storageLocation.directory
        : `${storageLocation.directory}/`;

      await FileSystem.makeDirectoryAsync(storageLocation.directory, { intermediates: true });

      const filename = `${teamNumber}_${Date.now()}.jpg`;
      destinationUri = `${targetDir}${filename}`;

      await FileSystem.copyAsync({
        from: sourceUri,
        to: destinationUri,
      });
    } catch (error) {
      console.warn(
        "Failed to persist robot photo to the local filesystem, falling back to source URI.",
        error
      );
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
