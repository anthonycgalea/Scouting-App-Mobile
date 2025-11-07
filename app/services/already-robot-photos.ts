import { apiRequest } from './api';
import { getDbOrThrow, schema } from '@/db';
import { eq } from 'drizzle-orm';

export type EventImageResponse = {
  id?: string | number | null;
  image_url?: string | null;
  imageUrl?: string | null;
  url?: string | null;
  public_url?: string | null;
  publicUrl?: string | null;
  description?: string | null;
  [key: string]: unknown;
};

export type EventImagesResponse = {
  teamNumber?: number | string | null;
  images?: EventImageResponse[] | null;
};

const POSSIBLE_URL_KEYS = ['image_url', 'imageUrl', 'url', 'public_url', 'publicUrl'];

const normalizeNumber = (value: number | string | null | undefined): number | null => {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();

    if (!trimmed) {
      return null;
    }

    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
};

const normalizeId = (value: string | number | null | undefined): string | null => {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) ? String(value) : null;
  }

  return null;
};

const tryExtractUrl = (value: EventImageResponse): string | null => {
  for (const key of POSSIBLE_URL_KEYS) {
    const possible = value?.[key];

    if (typeof possible === 'string') {
      const trimmed = possible.trim();

      if (trimmed.length > 0) {
        return trimmed;
      }
    }
  }

  return null;
};

const normalizeImage = (
  eventKey: string,
  teamNumber: number,
  image: EventImageResponse,
): typeof schema.alreadyRobotPhotos.$inferInsert | null => {
  const imageId = normalizeId(image?.id ?? null);

  if (!imageId) {
    return null;
  }

  const imageUrl = tryExtractUrl(image);
  const rawDescription = typeof image?.description === 'string' ? image.description.trim() : '';

  return {
    eventKey,
    teamNumber,
    imageId,
    imageUrl: imageUrl ?? null,
    description: rawDescription.length > 0 ? rawDescription : null,
  };
};

export function upsertAlreadyRobotPhotos(
  eventKey: string,
  response: EventImagesResponse[] | null | undefined,
): { inserted: number; received: number } {
  const entries: typeof schema.alreadyRobotPhotos.$inferInsert[] = [];
  const seen = new Set<string>();

  if (Array.isArray(response)) {
    for (const item of response) {
      const teamNumber = normalizeNumber(item?.teamNumber ?? null);

      if (teamNumber === null) {
        continue;
      }

      if (!Array.isArray(item?.images) || item.images.length === 0) {
        continue;
      }

      for (const image of item.images) {
        const normalized = normalizeImage(eventKey, teamNumber, image ?? {});

        if (!normalized) {
          continue;
        }

        const key = `${normalized.teamNumber}#${normalized.imageId}`;

        if (seen.has(key)) {
          continue;
        }

        seen.add(key);
        entries.push(normalized);
      }
    }
  }

  const db = getDbOrThrow();

  const inserted = db.transaction((tx) => {
    tx
      .delete(schema.alreadyRobotPhotos)
      .where(eq(schema.alreadyRobotPhotos.eventKey, eventKey))
      .run();

    if (entries.length === 0) {
      return 0;
    }

    let inserted = 0;

    for (const entry of entries) {
      const result = tx
        .insert(schema.alreadyRobotPhotos)
        .values(entry)
        .onConflictDoNothing()
        .run();

      if (result.rowsAffected > 0) {
        inserted += 1;
      }
    }

    return inserted;
  });

  return { inserted, received: entries.length };
}

export async function syncAlreadyRobotPhotos(eventKey: string): Promise<number> {
  const response = await apiRequest<EventImagesResponse[] | null | undefined>('/event/images', {
    method: 'GET',
  });

  const { inserted } = upsertAlreadyRobotPhotos(eventKey, response);

  return inserted;
}
