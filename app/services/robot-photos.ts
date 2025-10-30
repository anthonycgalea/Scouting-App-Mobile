import { eq } from 'drizzle-orm';

import { getDbOrThrow, schema } from '@/db';
import { tryUploadRobotPhotoRecord } from '@/src/services/robotPhotos';

export async function syncPendingRobotPhotos(): Promise<number> {
  const db = getDbOrThrow();
  const rows = db
    .select({
      id: schema.robotPhotos.id,
      eventKey: schema.robotPhotos.eventKey,
      teamNumber: schema.robotPhotos.teamNumber,
      localUri: schema.robotPhotos.localUri,
    })
    .from(schema.robotPhotos)
    .where(eq(schema.robotPhotos.uploadPending, 1))
    .all();

  let uploaded = 0;

  for (const row of rows) {
    const success = await tryUploadRobotPhotoRecord(row);

    if (success) {
      uploaded += 1;
    }
  }

  return uploaded;
}
