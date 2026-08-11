import { useEffect, useMemo, useState } from "react";
import type { ActivityDefinitionRecord } from "../domain/activityCatalog";
import type { ActivitySessionRecord } from "../domain/activitySession";
import { buildTagRpgLevels, type TagInsightTag } from "../domain/tagInsights";
import { subscribeTagInsightsSource } from "../data/tagInsightsRepository";

export function useTagRpgLevels(
  tags: readonly TagInsightTag[],
  selectedTagIds: readonly string[],
  minutesPerLevel: number,
) {
  const [nowMs, setNowMs] = useState(Date.now());
  const [records, setRecords] = useState<ActivitySessionRecord[]>([]);
  const [definitions, setDefinitions] = useState<ActivityDefinitionRecord[]>(
    [],
  );
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    const subscription = subscribeTagInsightsSource((source) => {
      setRecords(source.records);
      setDefinitions(source.definitions);
    }, setError);
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!records.some((record) => record.status === "running")) return;
    const interval = window.setInterval(() => setNowMs(Date.now()), 1_000);
    return () => window.clearInterval(interval);
  }, [records]);

  return {
    levels: useMemo(
      () =>
        buildTagRpgLevels({
          records,
          definitions,
          tags,
          selectedTagIds,
          minutesPerLevel,
          nowMs,
        }),
      [definitions, minutesPerLevel, nowMs, records, selectedTagIds, tags],
    ),
    error,
  };
}
