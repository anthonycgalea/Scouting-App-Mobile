import { getDbOrThrow, schema } from '@/db';
import { eq } from 'drizzle-orm';

const SINGLETON_ID = 1;

export function getActiveEvent(): string | null {
  const db = getDbOrThrow();

  const record = db
    .select({ event: schema.loggedInEvents.event })
    .from(schema.loggedInEvents)
    .limit(1)
    .all();

  return (record[0]?.event as string | null | undefined) ?? null;
}

export function setActiveEvent(event: string | null | undefined): void {
  const db = getDbOrThrow();
  const normalizedEvent = event ?? null;

  db.transaction((tx) => {
    const existing = tx
      .select()
      .from(schema.loggedInEvents)
      .where(eq(schema.loggedInEvents.id, SINGLETON_ID))
      .limit(1)
      .all();

    if (existing.length === 0) {
      tx.insert(schema.loggedInEvents)
        .values({ id: SINGLETON_ID, event: normalizedEvent })
        .run();
      return;
    }

    tx
      .update(schema.loggedInEvents)
      .set({ event: normalizedEvent })
      .where(eq(schema.loggedInEvents.id, SINGLETON_ID))
      .run();
  });
}

export function removeActiveEvent(): void {
  const db = getDbOrThrow();

  db.transaction((tx) => {
    tx
      .delete(schema.loggedInEvents)
      .where(eq(schema.loggedInEvents.id, SINGLETON_ID))
      .run();
  });
}
