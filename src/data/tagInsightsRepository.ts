import { liveQuery } from "dexie";
import { normalizeActivityDefinition } from "../domain/activityCatalog";
import { normalizeActivitySessionRecord } from "../domain/activitySession";
import { timeSliceDb } from "./timesliceDb";

export async function readTagInsightsSource() {
  const [rawRecords, rawDefinitions] = await Promise.all([
    timeSliceDb.activitySessions.toArray(),
    timeSliceDb.activityDefinitions.toArray(),
  ]);
  return {
    records: rawRecords
      .map(normalizeActivitySessionRecord)
      .filter((record) => record !== null),
    definitions: rawDefinitions
      .map(normalizeActivityDefinition)
      .filter((definition) => definition !== null),
  };
}

export function subscribeTagInsightsSource(
  next: (source: Awaited<ReturnType<typeof readTagInsightsSource>>) => void,
  error: (reason: unknown) => void,
) {
  return liveQuery(readTagInsightsSource).subscribe({ next, error });
}
