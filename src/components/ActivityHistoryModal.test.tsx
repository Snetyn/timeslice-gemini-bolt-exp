import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ActivityHistoryModal } from "./ActivityHistoryModal";

describe("ActivityHistoryModal", () => {
  it("renders an accessible compact empty history", () => {
    const html = renderToStaticMarkup(
      <ActivityHistoryModal onClose={() => undefined} />,
    );
    expect(html).toContain('role="dialog"');
    expect(html).toContain("Activity history");
    expect(html).toContain("Show removed");
    expect(html).toContain("Completed activity intervals will appear here");
  });

  it("disables corrections in a view-only window", () => {
    const html = renderToStaticMarkup(
      <ActivityHistoryModal onClose={() => undefined} readOnly />,
    );
    expect(html).toContain("This window is view-only");
  });
});
