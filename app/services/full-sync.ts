import { retrieveEventInfo, type RetrieveEventInfoResult } from './event-info';
import { updateGeneralData, type UpdateGeneralDataResult } from './general-data';
import { getActiveEvent } from './logged-in-event';
import { getActiveOrganizationId } from './logged-in-organization';
import { syncDataWithServer, type SyncDataWithServerResult } from './sync-data';

export type FullSyncResult = {
  generalData: UpdateGeneralDataResult;
  eventInfo: RetrieveEventInfoResult | null;
  dataSync: SyncDataWithServerResult | null;
};

export async function runFullSync(): Promise<FullSyncResult> {
  const generalData = await updateGeneralData();

  const organizationId = getActiveOrganizationId();
  const activeEvent = getActiveEvent();

  let dataSync: SyncDataWithServerResult | null = null;
  let eventInfo: RetrieveEventInfoResult | null = null;

  if (organizationId !== null) {
    dataSync = await syncDataWithServer(organizationId);
    eventInfo = dataSync.eventInfo;
  } else if (activeEvent) {
    eventInfo = await retrieveEventInfo();
  }

  return { generalData, eventInfo, dataSync };
}
