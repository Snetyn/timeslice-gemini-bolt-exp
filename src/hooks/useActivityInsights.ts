import { useEffect, useMemo, useState } from "react";
import {
  buildActivityInsights,
  type InsightsPeriod,
} from "../domain/activityInsights";
import { subscribeInsightsSource } from "../data/activityInsightsRepository";
import type { ActivitySessionRecord } from "../domain/activitySession";

export function useActivityInsights(period: InsightsPeriod, enabled = true) {
  const [nowMs, setNowMs] = useState(Date.now());
  const [sessions, setSessions] = useState<ActivitySessionRecord[]>([]);
  const [archivedAreaIds, setArchivedAreaIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    if (!enabled) return;
    const subscription = subscribeInsightsSource(
      (source) => {
        setSessions(source.sessions);
        setArchivedAreaIds(source.archivedAreaIds);
      },
      setError,
    );
    return () => subscription.unsubscribe();
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    setNowMs(Date.now());
    const interval = window.setInterval(() => setNowMs(Date.now()), 1_000);
    return () => window.clearInterval(interval);
  }, [enabled]);

  return {
    insights: useMemo(
      () => buildActivityInsights(sessions, period, nowMs, archivedAreaIds),
      [archivedAreaIds, nowMs, period, sessions],
    ),
    error,
  };
}
