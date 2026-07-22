import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SessionReportModal } from "./SessionReportModal";
import type { SessionReport } from "../lib/sessionReport";

const report: SessionReport = {
  rows: [
    {
      id: "cleaning",
      name: "Cleaning",
      color: "#84cc16",
      planned: 90 * 60,
      actual: 80 * 60,
      delta: -10 * 60,
      overtimeSeconds: 0,
      drainedSeconds: 60,
      receivedOvertime: 0,
    },
    {
      id: "app",
      name: "App",
      color: "#6d28d9",
      planned: 30 * 60,
      actual: 40 * 60,
      delta: 10 * 60,
      overtimeSeconds: 10 * 60,
      drainedSeconds: 0,
      receivedOvertime: 60,
    },
  ],
  totals: {
    planned: 120 * 60,
    actual: 120 * 60,
    delta: 0,
    pct: 100,
    overtime: 10 * 60,
    drained: 60,
    received: 60,
  },
};

describe("SessionReportModal", () => {
  it("keeps the existing summary as the default view", () => {
    const html = renderToStaticMarkup(
      <SessionReportModal report={report} onClose={() => undefined} />,
    );
    expect(html).toContain("Summary");
    expect(html).toContain("Task wheel");
    expect(html).toContain("Planned 120m, actual 120m");
    expect(html).not.toContain("Task wheel legend");
  });

  it("renders the accessible two-ring task view and static legend", () => {
    const html = renderToStaticMarkup(
      <SessionReportModal
        report={report}
        view="tasks"
        onClose={() => undefined}
      />,
    );
    expect(html).toContain("Outer: Plan");
    expect(html).toContain("Inner: Actual");
    expect(html).toContain("Task wheel legend");
    expect(html).toContain("Outer ring shows 120m planned");
    expect(html).toContain("P 90m");
    expect(html).toContain("A 80m");
  });

  it("uses the chosen visualization for historical reports", () => {
    const html = renderToStaticMarkup(
      <SessionReportModal
        report={report}
        view="tasks"
        history={[
          {
            id: "history-1",
            value: { completedAtMs: 1_700_000_000_000, report },
          },
        ]}
        onClose={() => undefined}
      />,
    );
    expect(html).toContain("Recent sessions (1)");
    expect(html).toContain("Task wheel legend");
  });
});
