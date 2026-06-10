import { describe, it, expect } from "vitest";
import { renderFrame, renderHud, ANSI, type HudState } from "../src/lib/hud.js";

// ---------------------------------------------------------------------------
// Existing renderFrame tests (unchanged)
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// renderHud tests
// ---------------------------------------------------------------------------

/** Baseline HudState for a normal session (no break, no target, not zen). */
function baseState(overrides: Partial<HudState> = {}): HudState {
  return {
    rows: 24,
    cols: 80,
    time: "00:05:00",
    style: "simple",
    zen: false,
    showControls: true,
    onBreak: false,
    focusS: 300,
    totalBreakS: 0,
    keybindings: { pause: "p", reset: "r", quit: "q", break: "b", category: "c" },
    ...overrides,
  };
}

describe("renderHud", () => {
  it("starts with ANSI.clear", () => {
    const frame = renderHud(baseState());
    expect(frame.startsWith(ANSI.clear)).toBe(true);
  });

  it("simple style: contains the time string", () => {
    const frame = renderHud(baseState({ time: "01:23:45" }));
    expect(frame).toContain("01:23:45");
  });

  it("block style: contains block characters (█)", () => {
    const frame = renderHud(baseState({ style: "block", rows: 30, cols: 120 }));
    expect(frame).toContain("█");
  });

  it("shows controls footer by default (not zen)", () => {
    const frame = renderHud(baseState());
    // Footer should contain the keybinding hints
    expect(frame).toContain("[p] pause");
    expect(frame).toContain("[b] break");
    expect(frame).toContain("[q] stop");
  });

  it("zen mode: no footer shown", () => {
    const frame = renderHud(baseState({ zen: true }));
    expect(frame).not.toContain("[p] pause");
    expect(frame).not.toContain("[b] break");
  });

  it("zen mode: no progress block shown", () => {
    const frame = renderHud(
      baseState({
        zen: true,
        focusTargetS: 3600,
        goal: "Ship v2",
      }),
    );
    // Progress bar and goal should be absent in zen mode
    expect(frame).not.toContain("Ship v2");
    expect(frame).not.toContain("███");
  });

  it("showControls=false: no footer even outside zen", () => {
    const frame = renderHud(baseState({ showControls: false }));
    expect(frame).not.toContain("[p] pause");
  });

  it("on break: shows BREAK line with category", () => {
    const frame = renderHud(
      baseState({
        onBreak: true,
        breakCategory: "meal",
        currentBreakS: 90,
        suggestedBreakS: 300,
      }),
    );
    expect(frame).toContain("BREAK");
    expect(frame).toContain("meal");
    expect(frame).toContain("01:30"); // 90s formatted as MM:SS
  });

  it("on break: shows category picker keys 1–6", () => {
    const frame = renderHud(
      baseState({
        onBreak: true,
        breakCategory: "rest",
        currentBreakS: 0,
      }),
    );
    expect(frame).toContain("[1]rest");
    expect(frame).toContain("[2]meal");
    expect(frame).toContain("[3]exercise");
    expect(frame).toContain("[b] resume");
  });

  it("shows progress bar when focusTargetS is set", () => {
    const frame = renderHud(
      baseState({
        focusTargetS: 3600,
        focusS: 1800, // 50%
      }),
    );
    // Should contain a progress bar (filled + empty cells)
    expect(frame).toContain("█");
    expect(frame).toContain("50%");
  });

  it("shows ✦ win marker when focus target met and budget respected", () => {
    const frame = renderHud(
      baseState({
        focusTargetS: 300,
        focusS: 300,
        totalBreakS: 10,
        breakBudgetS: 60,
      }),
    );
    expect(frame).toContain("✦");
  });

  it("does NOT show ✦ when budget exceeded", () => {
    const frame = renderHud(
      baseState({
        focusTargetS: 300,
        focusS: 300,
        totalBreakS: 100,
        breakBudgetS: 60,
      }),
    );
    expect(frame).not.toContain("✦");
  });

  it("too small terminal: falls back to clock-only (no footer)", () => {
    // 8 rows is enough for 1 clock row but not for clock + extras
    const frame = renderHud(
      baseState({
        rows: 8,
        cols: 80,
        focusTargetS: 3600,
        goal: "Write tests",
      }),
    );
    // Should contain the time, but may not have the footer or progress when squeezed
    expect(frame).toContain("00:05:00");
  });

  it("returns empty when terminal is too small even for the clock", () => {
    const frame = renderHud(baseState({ rows: 0, cols: 80 }));
    expect(frame).toBe("");
  });

  it("returns empty for non-finite dimensions", () => {
    const frame = renderHud(baseState({ rows: NaN, cols: 80 }));
    expect(frame).toBe("");
  });

  it("applies color around clock content when colorOn is set", () => {
    const colorOn = "\x1b[38;5;46m";
    const frame = renderHud(baseState({ colorOn, colorOff: ANSI.reset }));
    expect(frame).toContain(colorOn);
    expect(frame).toContain(ANSI.reset);
  });

  it("shows goal label in progress when goal is set without focusTargetS", () => {
    const frame = renderHud(baseState({ goal: "Deep work" }));
    expect(frame).toContain("Deep work");
  });

  it("shows break budget line when breakBudgetS is set", () => {
    const frame = renderHud(
      baseState({
        breakBudgetS: 600,
        totalBreakS: 120,
        focusS: 1200,
      }),
    );
    expect(frame).toContain("break");
    expect(frame).toContain("10m"); // 600s = 10m
  });

  it("block style with extras on modest terminal keeps footer and progress visible", () => {
    // 70×18: wide enough for the block clock at scale 1 (33 cols), tall enough
    // for BIG_ROWS (5) but modest enough that a greedy scale would crowd extras.
    // The reserve-first logic must leave room for the progress and footer.
    const frame = renderHud(
      baseState({
        style: "block",
        rows: 18,
        cols: 70,
        zen: false,
        showControls: true,
        focusTargetS: 3600,
        breakBudgetS: 600,
        totalBreakS: 120,
        focusS: 1800,
        keybindings: { pause: "p", reset: "r", quit: "q", break: "b", category: "c" },
      }),
    );
    // Footer must be present (counter did not crowd it off-screen)
    expect(frame).toContain("pause");
    // Progress block must be present
    expect(frame).toContain("break");
  });
});

// ---------------------------------------------------------------------------
// parseDurationToS wiring: invalid input throws
// ---------------------------------------------------------------------------

describe("parseDurationToS (format level)", () => {
  it("rejects an empty string", async () => {
    const { parseDurationToS } = await import("../src/lib/format.js");
    expect(() => parseDurationToS("")).toThrow("invalid duration");
  });

  it("rejects a non-duration string", async () => {
    const { parseDurationToS } = await import("../src/lib/format.js");
    expect(() => parseDurationToS("not-a-duration")).toThrow("invalid duration");
  });

  it("accepts valid duration strings", async () => {
    const { parseDurationToS } = await import("../src/lib/format.js");
    expect(parseDurationToS("1h")).toBe(3600);
    expect(parseDurationToS("90m")).toBe(5400);
    expect(parseDurationToS("3600")).toBe(3600);
  });
});
