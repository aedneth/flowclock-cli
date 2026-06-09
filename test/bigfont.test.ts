import { describe, it, expect } from "vitest";
import {
  renderBigLines,
  bigWidth,
  computeScale,
  BIG_ROWS,
  BIG_MIN_COLS,
} from "../src/lib/bigfont.js";
import { renderBigFrame, ANSI } from "../src/lib/hud.js";

describe("renderBigLines", () => {
  it("produces BIG_ROWS equal-width rows at scale 1 (default)", () => {
    const lines = renderBigLines("12:34:56");
    expect(lines).toHaveLength(BIG_ROWS);
    const w = lines[0]!.length;
    expect(lines.every((l) => l.length === w)).toBe(true);
    expect(w).toBe(bigWidth("12:34:56"));
  });

  it("uses block characters for digits", () => {
    expect(renderBigLines("8").join("")).toContain("█");
  });

  it("HH:MM:SS base width equals BIG_MIN_COLS (scale-1 minimum)", () => {
    expect(bigWidth("00:00:00")).toBe(BIG_MIN_COLS);
  });

  it("never throws on unexpected characters", () => {
    expect(() => renderBigLines("ab")).not.toThrow();
    expect(renderBigLines("?")).toHaveLength(BIG_ROWS);
  });

  it("scale=2 doubles both width and height", () => {
    const s1 = renderBigLines("0", 1);
    const s2 = renderBigLines("0", 2);
    expect(s2.length).toBe(s1.length * 2);
    expect(s2[0]!.length).toBe(s1[0]!.length * 2);
  });
});

describe("computeScale", () => {
  it("returns 1 when only scale-1 fits", () => {
    // 60/33=1, 10/5=2 → 1
    expect(computeScale(60, 10, "00:00:00")).toBe(1);
  });

  it("returns 2 for an 80-col 20-row terminal", () => {
    // 80/33=2, 20/5=4 → 2
    expect(computeScale(80, 20, "00:00:00")).toBe(2);
  });

  it("caps at 10 for very large terminals", () => {
    expect(computeScale(9999, 9999, "00:00:00")).toBe(10);
  });

  it("is height-limited when rows is the binding constraint", () => {
    // 200/33=6 (width allows 6), but 6/5=1 (height only fits scale 1)
    expect(computeScale(200, 6, "00:00:00")).toBe(1);
  });
});

describe("renderBigFrame", () => {
  it("renders the block font on a wide terminal", () => {
    const frame = renderBigFrame({ rows: 20, cols: 80, time: "12:34:56" });
    expect(frame).not.toBe("");
    expect(frame).toContain("█");
    expect(frame.startsWith(ANSI.clear)).toBe(true);
  });

  it("scales up on a large terminal", () => {
    const narrow = renderBigFrame({ rows: 20, cols: 80, time: "00:00:00" });
    const wide = renderBigFrame({ rows: 20, cols: 160, time: "00:00:00" });
    // wider terminal → more block characters
    expect(wide.length).toBeGreaterThan(narrow.length);
  });

  it("falls back (empty) when terminal is narrower than scale-1 minimum", () => {
    // "12:34:56" needs 33 cols at scale 1; 20 cols must fall back
    expect(renderBigFrame({ rows: 20, cols: 20, time: "12:34:56" })).toBe("");
  });

  it("falls back (empty) when too few rows", () => {
    expect(renderBigFrame({ rows: 3, cols: 80, time: "12:34:56" })).toBe("");
  });

  it("falls back for non-finite dimensions", () => {
    expect(renderBigFrame({ rows: NaN, cols: 80, time: "12:34:56" })).toBe("");
  });

  it("wraps each row in color when provided", () => {
    const frame = renderBigFrame({
      rows: 20,
      cols: 80,
      time: "00:00:00",
      colorOn: "\x1b[32m",
      colorOff: ANSI.reset,
    });
    expect(frame).toContain("\x1b[32m");
    expect(frame).toContain(ANSI.reset);
  });
});
