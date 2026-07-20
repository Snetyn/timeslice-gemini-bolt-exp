export const secondsBetween = (
  startedAt: Date | string | number,
  now = Date.now(),
) => {
  const started = new Date(startedAt).getTime();
  if (!Number.isFinite(started)) return 0;
  return Math.max(0, Math.floor((now - started) / 1000));
};

export const clampSeconds = (
  seconds: number,
  maximum = Number.POSITIVE_INFINITY,
) => {
  if (!Number.isFinite(seconds)) return 0;
  return Math.min(Math.max(0, Math.floor(seconds)), maximum);
};

export const isNewDay = (savedDate: string | null, now = new Date()) =>
  Boolean(savedDate) && savedDate !== now.toDateString();
