import { liveQuery } from "dexie";
import { normalizeActivitySessionRecord } from "../domain/activitySession";
import { timeSliceDb } from "./timesliceDb";

export async function readInsightsSource() {
  const [rawSessions, areas] = await Promise.all([
    timeSliceDb.activitySessions.toArray(),
    timeSliceDb.lifeAreas.toArray(),
  ]);
  return {
    sessions: rawSessions
      .map(normalizeActivitySessionRecord)
      .filter((record) => record !== null),
    archivedAreaIds: new Set(
      areas.filter((area) => area.archivedAtMs !== undefined).map((area) => area.id),
    ),
  };
}

export function subscribeInsightsSource(
  next: (source: Awaited<ReturnType<typeof readInsightsSource>>) => void,
  error: (reason: unknown) => void,
) {
  return liveQuery(readInsightsSource).subscribe({ next, error });
}
