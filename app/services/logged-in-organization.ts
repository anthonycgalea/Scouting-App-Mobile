import { getDbOrThrow, schema } from '@/db';
import type { Organization } from '@/db/schema';
import { eq } from 'drizzle-orm';

const SINGLETON_ID = 1;

type ActiveOrganizationListener = (organizationId: number | null) => void;

const listeners = new Set<ActiveOrganizationListener>();
let cachedOrganizationId: number | null | undefined = undefined;

function readOrganizationIdFromDb(): number | null {
  const db = getDbOrThrow();

  const record = db
    .select({ organizationId: schema.loggedInOrganizations.organizationId })
    .from(schema.loggedInOrganizations)
    .where(eq(schema.loggedInOrganizations.id, SINGLETON_ID))
    .limit(1)
    .all();

  const organizationId = record[0]?.organizationId;

  return typeof organizationId === 'number' ? organizationId : null;
}

function notifyListeners(organizationId: number | null) {
  for (const listener of listeners) {
    try {
      listener(organizationId);
    } catch (error) {
      console.error('logged-in-organization listener error', error);
    }
  }
}

function findOrganizationById(organizationId: number): Organization | null {
  const db = getDbOrThrow();

  const record = db
    .select()
    .from(schema.organizations)
    .where(eq(schema.organizations.id, organizationId))
    .limit(1)
    .all();

  return (record[0] as Organization | undefined) ?? null;
}

function normalizeOrganizationId(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function updateCache(organizationId: number | null) {
  cachedOrganizationId = organizationId;
}

export function getActiveOrganizationId(): number | null {
  if (cachedOrganizationId === undefined) {
    updateCache(readOrganizationIdFromDb());
  }

  return cachedOrganizationId ?? null;
}

export function getActiveOrganization(): Organization | null {
  const organizationId = getActiveOrganizationId();

  if (organizationId === null) {
    return null;
  }

  return findOrganizationById(organizationId);
}

export function getOrganizationById(organizationId: number | null | undefined): Organization | null {
  if (typeof organizationId !== 'number' || !Number.isFinite(organizationId)) {
    return null;
  }

  return findOrganizationById(organizationId);
}

export function subscribeToActiveOrganization(
  listener: ActiveOrganizationListener,
): () => void {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}

export function setActiveOrganization(organizationId: number | null | undefined): void {
  const normalizedOrganizationId = normalizeOrganizationId(organizationId);
  const db = getDbOrThrow();

  db.transaction((tx) => {
    const existing = tx
      .select()
      .from(schema.loggedInOrganizations)
      .where(eq(schema.loggedInOrganizations.id, SINGLETON_ID))
      .limit(1)
      .all();

    if (existing.length === 0) {
      tx
        .insert(schema.loggedInOrganizations)
        .values({ id: SINGLETON_ID, organizationId: normalizedOrganizationId })
        .run();
      return;
    }

    tx
      .update(schema.loggedInOrganizations)
      .set({ organizationId: normalizedOrganizationId })
      .where(eq(schema.loggedInOrganizations.id, SINGLETON_ID))
      .run();
  });

  updateCache(normalizedOrganizationId);
  notifyListeners(normalizedOrganizationId);
}

export function removeActiveOrganization(): void {
  const db = getDbOrThrow();

  db.transaction((tx) => {
    tx
      .delete(schema.loggedInOrganizations)
      .where(eq(schema.loggedInOrganizations.id, SINGLETON_ID))
      .run();
  });

  updateCache(null);
  notifyListeners(null);
}
