import { describe, it, expect } from "vitest";
import { renderFrame, ANSI } from "../src/lib/hud.js";

describe("renderFrame", () => {
  it("centers the time and uses 1-based ANSI positioning", () => {
    const frame = renderFrame({ rows: 10, cols: 30, time: "00:00:05" });
    // row = floor(10/2)+1 = 6 ; col = floor((30-8)/2)+1 = 12
    expect(frame).toBe(`${ANSI.clear}${ANSI.cursorTo(6, 12)}00:00:05`);
  });

  it("returns empty (no draw) when too narrow for the time string", () => {
    expect(renderFrame({ rows: 10, cols: 5, time: "00:00:05" })).toBe("");
  });

  it("returns empty when there are no rows", () => {
    expect(renderFrame({ rows: 0, cols: 80, time: "00:00:05" })).toBe("");
  });

  it("returns empty for non-finite dimensions", () => {
    expect(renderFrame({ rows: NaN, cols: 80, time: "00:00:05" })).toBe("");
  });

  it("clamps the column to at least 1", () => {
    const frame = renderFrame({ rows: 2, cols: 8, time: "00:00:05" });
    expect(frame).toContain(ANSI.cursorTo(2, 1));
  });

  it("wraps the time in color when provided", () => {
    const frame = renderFrame({
      rows: 4,
      cols: 20,
      time: "00:00:01",
      colorOn: "\x1b[32m",
      colorOff: ANSI.reset,
    });
    expect(frame).toContain(`\x1b[32m00:00:01${ANSI.reset}`);
  });
});
