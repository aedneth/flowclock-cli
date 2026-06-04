import { describe, it, expect } from "vitest";
import {
  renderBigLines,
  bigWidth,
  BIG_ROWS,
  BIG_MIN_COLS,
} from "../src/lib/bigfont.js";
import { renderBigFrame, ANSI } from "../src/lib/hud.js";

describe("renderBigLines", () => {
  it("produces BIG_ROWS equal-width rows", () => {
    const lines = renderBigLines("12:34:56");
    expect(lines).toHaveLength(BIG_ROWS);
    const w = lines[0]!.length;
    expect(lines.every((l) => l.length === w)).toBe(true);
    expect(w).toBe(bigWidth("12:34:56"));
  });

  it("uses block characters for digits", () => {
    expect(renderBigLines("8").join("")).toContain("█");
  });

  it("renders a full HH:MM:SS under 60 columns", () => {
    expect(bigWidth("00:00:00")).toBeLessThan(BIG_MIN_COLS);
  });

  it("never throws on unexpected characters", () => {
    expect(() => renderBigLines("ab")).not.toThrow();
    expect(renderBigLines("?")).toHaveLength(BIG_ROWS);
  });
});

describe("renderBigFrame", () => {
  it("renders the block font on a wide terminal", () => {
    const frame = renderBigFrame({ rows: 20, cols: 80, time: "12:34:56" });
    expect(frame).not.toBe("");
    expect(frame).toContain("█");
    expect(frame.startsWith(ANSI.clear)).toBe(true);
  });

  it("falls back (empty) below BIG_MIN_COLS so the caller uses compact HUD", () => {
    expect(renderBigFrame({ rows: 20, cols: 40, time: "12:34:56" })).toBe("");
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
