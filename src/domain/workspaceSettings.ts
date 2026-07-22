import type { VaultPredictionMode } from "./sessionSchedule";

export function resolveVaultPredictionMode(
  savedSettings: unknown,
): VaultPredictionMode {
  if (!savedSettings || typeof savedSettings !== "object") return "independent";
  const saved = savedSettings as Record<string, unknown>;
  return saved.vaultPredictionMode === "independent" ? "independent" : "linked";
}
