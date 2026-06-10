import { describe, it, expect } from "vitest";

import { renderHelp } from "../src/tui/views/help.js";
import { displayWidth } from "../src/lib/tui/draw.js";
import type { Rect } from "../src/lib/tui/layout.js";

const RECT: Rect = { top: 0, left: 0, width: 60, height: 24 };

describe("renderHelp", () => {
  it("returns a string[] of exactly rect.height rows (no color)", () => {
    const rows = renderHelp(RECT, "neon", false);
    expect(rows).toHaveLength(24);
  });

  it("output contains 'Session'", () => {
    const rows = renderHelp(RECT, "neon", false);
    expect(rows.join("\n")).toContain("Session");
  });

  it("output contains 'break'", () => {
    const rows = renderHelp(RECT, "neon", false);
    expect(rows.join("\n")).toContain("break");
  });

  it("output contains 'palette'", () => {
    const rows = renderHelp(RECT, "neon", false);
    expect(rows.join("\n")).toContain("palette");
  });

  it("output contains 'Flowtime'", () => {
    const rows = renderHelp(RECT, "neon", false);
    expect(rows.join("\n")).toContain("Flowtime");
  });

  it("every row has displayWidth <= rect.width (no overflow)", () => {
    const rows = renderHelp(RECT, "neon", false);
    for (const row of rows) {
      expect(displayWidth(row)).toBeLessThanOrEqual(60);
    }
  });

  it("with color=true does not throw and still returns exactly rect.height rows", () => {
    const rows = renderHelp(RECT, "neon", true);
    expect(rows).toHaveLength(24);
  });
});
