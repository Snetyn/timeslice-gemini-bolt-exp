import { describe, expect, it } from "vitest";
import { resolveVaultPredictionMode } from "./workspaceSettings";

describe("Vault prediction setting migration", () => {
  it("keeps existing workspaces linked unless they explicitly changed", () => {
    expect(resolveVaultPredictionMode({ showEndTime: true })).toBe("linked");
    expect(resolveVaultPredictionMode({ vaultPredictionMode: "independent" })).toBe("independent");
  });

  it("allows a clean workspace to default to Independent", () => {
    expect(resolveVaultPredictionMode(null)).toBe("independent");
  });
});
