export type SyncCompletedEvent = {
  syncedAt: number;
  organizationId: number;
  eventCode: string;
};

type SyncCompletedListener = (event: SyncCompletedEvent) => void;

const syncCompletedListeners = new Set<SyncCompletedListener>();

export function subscribeToSyncCompleted(listener: SyncCompletedListener): () => void {
  syncCompletedListeners.add(listener);

  return () => {
    syncCompletedListeners.delete(listener);
  };
}

export function emitSyncCompleted(event: SyncCompletedEvent): void {
  syncCompletedListeners.forEach((listener) => {
    listener(event);
  });
}
