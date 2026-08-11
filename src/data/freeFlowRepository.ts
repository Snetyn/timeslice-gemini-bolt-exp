import {
  legacySingleToFreeFlowRun,
  normalizeFreeFlowRun,
  type FreeFlowRun,
} from "../domain/freeFlow";
import { timeSliceDb, transactIdempotent } from "./timesliceDb";

const ACTIVE_RUN_ID = "free-flow:active-run";
const IMPORT_MARKER_ID = "free-flow:legacy-single-imported";
const runRecordId = (id: string) => `free-flow:run:${id}`;

const safeNow = (value = Date.now()) =>
  Number.isFinite(value) ? Math.max(0, Math.floor(value)) : Date.now();

export async function getFreeFlowRun(id: string) {
  const record = await timeSliceDb.meta.get(runRecordId(id));
  return normalizeFreeFlowRun(record?.value);
}

export async function getActiveFreeFlowRun() {
  const pointer = await timeSliceDb.meta.get(ACTIVE_RUN_ID);
  if (typeof pointer?.value !== "string") return null;
  const run = await getFreeFlowRun(pointer.value);
  return run?.status === "active" || run?.status === "draft" ? run : null;
}

export async function listFreeFlowRuns() {
  const records = await timeSliceDb.meta
    .where("id")
    .startsWith("free-flow:run:")
    .toArray();
  return records
    .map((record) => normalizeFreeFlowRun(record.value))
    .filter((run): run is FreeFlowRun => Boolean(run))
    .sort((left, right) => right.updatedAtMs - left.updatedAtMs);
}

export async function saveFreeFlowRun(
  run: FreeFlowRun,
  mutationId: string = crypto.randomUUID(),
) {
  const normalized = normalizeFreeFlowRun(run);
  if (!normalized) throw new TypeError("Invalid Free Flow run.");
  const fingerprint = JSON.stringify(normalized);
  return transactIdempotent(
    [],
    { id: mutationId, fingerprint },
    async (revision) => {
      const updatedAtMs = safeNow(normalized.updatedAtMs);
      const saved = { ...normalized, revision, updatedAtMs };
      await timeSliceDb.meta.put({
        id: runRecordId(saved.id),
        value: saved,
        revision,
        updatedAtMs,
      });
      if (saved.status === "active" || saved.status === "draft") {
        await timeSliceDb.meta.put({
          id: ACTIVE_RUN_ID,
          value: saved.id,
          revision,
          updatedAtMs,
        });
      } else {
        const active = await timeSliceDb.meta.get(ACTIVE_RUN_ID);
        if (active?.value === saved.id)
          await timeSliceDb.meta.delete(ACTIVE_RUN_ID);
      }
      return saved;
    },
  );
}

/** Copies legacy Single state once and deliberately leaves its source intact. */
export async function importLegacySingleState(
  legacyValue: unknown,
  atMs = Date.now(),
) {
  const marker = await timeSliceDb.meta.get(IMPORT_MARKER_ID);
  if (marker) return getActiveFreeFlowRun();
  const imported = legacySingleToFreeFlowRun(legacyValue, atMs);
  const mutationId = `free-flow:legacy-import:${safeNow(atMs)}`;
  const fingerprint = JSON.stringify({ legacyValue, atMs: safeNow(atMs) });
  return transactIdempotent(
    [],
    { id: mutationId, fingerprint },
    async (revision) => {
      if (imported) {
        imported.revision = revision;
        await timeSliceDb.meta.put({
          id: runRecordId(imported.id),
          value: imported,
          revision,
          updatedAtMs: imported.updatedAtMs,
        });
        if (imported.status === "active") {
          await timeSliceDb.meta.put({
            id: ACTIVE_RUN_ID,
            value: imported.id,
            revision,
            updatedAtMs: safeNow(atMs),
          });
        }
      }
      await timeSliceDb.meta.put({
        id: IMPORT_MARKER_ID,
        value: { importedRunId: imported?.id || null },
        revision,
        updatedAtMs: safeNow(atMs),
      });
      return imported;
    },
  ).then((result) => result.value);
}
