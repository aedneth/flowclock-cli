/**
 * Tests for the Session view — the hero live-counter TUI panel.
 *
 * Key assertions:
 *  - The panel always returns exactly rect.height rows.
 *  - No row exceeds rect.width in display width.
 *  - Metadata lines (goal, focus progress, break, footer) SURVIVE alongside
 *    the big counter — verifying the reserve-first scaling guarantee.
 *  - Zen mode hides footer/progress chrome.
 *  - Color flag does not throw.
 */

import { describe, it, expect } from "vitest";
import { renderSession } from "../src/tui/views/session.js";
import { displayWidth } from "../src/lib/tui/draw.js";
import type { SessionViewState } from "../src/tui/views/session.js";
import type { Rect } from "../src/lib/tui/layout.js";

// ---------------------------------------------------------------------------
// Shared fixture helpers
// ---------------------------------------------------------------------------

const DEFAULT_KB = { pause: "p", reset: "r", quit: "q", break: "b", category: "c" };

function activeState(overrides: Partial<SessionViewState> = {}): SessionViewState {
  return {
    active: true,
    time: "00:42:17",
    goal: "Deep work",
    label: null,
    focusS: 2537,          // 42m 17s
    totalBreakS: 300,      // 5 min break so far
    onBreak: false,
    currentBreakS: 0,
    breakCategory: "rest",
    suggestedBreakS: null,
    focusTargetS: 3600,    // 1 hour
    breakBudgetS: 1200,    // 20 min budget
    zen: false,
    showControls: true,
    displayStyle: "block",
    keybindings: DEFAULT_KB,
    ...overrides,
  };
}

function rect(width: number, height: number): Rect {
  return { top: 0, left: 0, width, height };
}

// ---------------------------------------------------------------------------
// ACTIVE — 80×24 (standard terminal)
// ---------------------------------------------------------------------------

describe("renderSession — ACTIVE 80×24", () => {
  const state = activeState();
  const r = rect(80, 24);
  let rows: string[];

  // Compute once; share across its.
  rows = renderSession(state, r, "neon", false);

  it("returns exactly rect.height rows", () => {
    expect(rows).toHaveLength(24);
  });

  it("every row has displayWidth <= 80", () => {
    for (const row of rows) {
      expect(displayWidth(row)).toBeLessThanOrEqual(80);
    }
  });

  it("contains the goal text 'Deep work' — metadata survived", () => {
    const joined = rows.join("\n");
    expect(joined).toContain("Deep work");
  });

  it("contains 'focus' progress line — metadata survived", () => {
    const joined = rows.join("\n");
    expect(joined).toContain("focus");
  });

  it("contains 'break' progress line — metadata survived", () => {
    const joined = rows.join("\n");
    expect(joined).toContain("break");
  });

  it("contains 'pause' in the footer — footer survived alongside big counter (anti-overshadow guarantee)", () => {
    // This is the PRIMARY assertion proving the counter does NOT overshadow
    // the footer. If computeSessionScale reserved space correctly, the footer
    // controls will still be present in the output even with the big counter.
    const joined = rows.join("\n");
    expect(joined).toContain("pause");
  });

  it("contains 'stop' in the footer — quit binding visible", () => {
    const joined = rows.join("\n");
    expect(joined).toContain("stop");
  });
});

// ---------------------------------------------------------------------------
// ACTIVE — small 40×12 panel
// ---------------------------------------------------------------------------

describe("renderSession — ACTIVE small 40×12", () => {
  it("returns exactly 12 rows", () => {
    const rows = renderSession(activeState(), rect(40, 12), "neon", false);
    expect(rows).toHaveLength(12);
  });

  it("never throws", () => {
    expect(() => renderSession(activeState(), rect(40, 12), "neon", false)).not.toThrow();
  });

  it("all rows within width 40", () => {
    const rows = renderSession(activeState(), rect(40, 12), "neon", false);
    for (const row of rows) {
      expect(displayWidth(row)).toBeLessThanOrEqual(40);
    }
  });
});

// ---------------------------------------------------------------------------
// ACTIVE — very small 20×8 (force fallback to text clock)
// ---------------------------------------------------------------------------

describe("renderSession — ACTIVE tiny 20×8 (text-clock fallback)", () => {
  it("returns exactly 8 rows and never throws", () => {
    expect(() => {
      const rows = renderSession(activeState(), rect(20, 8), "neon", false);
      expect(rows).toHaveLength(8);
    }).not.toThrow();
  });

  it("all rows within width 20", () => {
    const rows = renderSession(activeState(), rect(20, 8), "neon", false);
    for (const row of rows) {
      expect(displayWidth(row)).toBeLessThanOrEqual(20);
    }
  });
});

// ---------------------------------------------------------------------------
// IDLE — 60×20
// ---------------------------------------------------------------------------

describe("renderSession — IDLE 60×20", () => {
  it("returns exactly 20 rows", () => {
    const rows = renderSession(
      { ...activeState(), active: false },
      rect(60, 20),
      "neon",
      false,
    );
    expect(rows).toHaveLength(20);
  });

  it("contains 'start'", () => {
    const rows = renderSession(
      { ...activeState(), active: false },
      rect(60, 20),
      "neon",
      false,
    );
    expect(rows.join("\n")).toContain("start");
  });

  it("all rows within width 60", () => {
    const rows = renderSession(
      { ...activeState(), active: false },
      rect(60, 20),
      "neon",
      false,
    );
    for (const row of rows) {
      expect(displayWidth(row)).toBeLessThanOrEqual(60);
    }
  });
});

// ---------------------------------------------------------------------------
// ZEN mode — footer hidden
// ---------------------------------------------------------------------------

describe("renderSession — zen mode", () => {
  it("footer text 'pause' is ABSENT in zen mode", () => {
    const rows = renderSession(activeState({ zen: true }), rect(80, 24), "neon", false);
    // The control hint should be suppressed entirely in zen mode.
    const joined = rows.join("\n");
    expect(joined).not.toContain("[p] pause");
    expect(joined).not.toContain("pause ·");
  });

  it("never throws in zen mode", () => {
    expect(() =>
      renderSession(activeState({ zen: true }), rect(80, 24), "neon", false),
    ).not.toThrow();
  });

  it("still returns exactly 24 rows in zen mode", () => {
    const rows = renderSession(activeState({ zen: true }), rect(80, 24), "neon", false);
    expect(rows).toHaveLength(24);
  });
});

// ---------------------------------------------------------------------------
// Color mode — should not throw
// ---------------------------------------------------------------------------

describe("renderSession — color mode", () => {
  it("color=true on 80×24 does not throw", () => {
    expect(() =>
      renderSession(activeState(), rect(80, 24), "neon", true),
    ).not.toThrow();
  });

  it("color=true returns exactly 24 rows", () => {
    const rows = renderSession(activeState(), rect(80, 24), "neon", true);
    expect(rows).toHaveLength(24);
  });

  it("color=true all rows display-width <= 80", () => {
    const rows = renderSession(activeState(), rect(80, 24), "neon", true);
    for (const row of rows) {
      expect(displayWidth(row)).toBeLessThanOrEqual(80);
    }
  });
});

// ---------------------------------------------------------------------------
// ON BREAK state
// ---------------------------------------------------------------------------

describe("renderSession — onBreak state", () => {
  const breakState = activeState({
    onBreak: true,
    currentBreakS: 125,
    breakCategory: "walk",
    suggestedBreakS: 480,
  });

  it("returns exactly 24 rows", () => {
    const rows = renderSession(breakState, rect(80, 24), "neon", false);
    expect(rows).toHaveLength(24);
  });

  it("contains '☕ on break'", () => {
    const rows = renderSession(breakState, rect(80, 24), "neon", false);
    expect(rows.join("\n")).toContain("on break");
  });

  it("contains the resume keybinding", () => {
    const rows = renderSession(breakState, rect(80, 24), "neon", false);
    expect(rows.join("\n")).toContain("resume");
  });

  it("all rows within width 80", () => {
    const rows = renderSession(breakState, rect(80, 24), "neon", false);
    for (const row of rows) {
      expect(displayWidth(row)).toBeLessThanOrEqual(80);
    }
  });
});

// ---------------------------------------------------------------------------
// No goal, no target, no budget — minimal state
// ---------------------------------------------------------------------------

describe("renderSession — minimal active state (no goal, no target)", () => {
  const minState = activeState({
    goal: null,
    label: null,
    focusTargetS: null,
    breakBudgetS: null,
    totalBreakS: 0,
  });

  it("returns exactly 24 rows and never throws", () => {
    expect(() => {
      const rows = renderSession(minState, rect(80, 24), "neon", false);
      expect(rows).toHaveLength(24);
    }).not.toThrow();
  });

  it("all rows within width 80", () => {
    const rows = renderSession(minState, rect(80, 24), "neon", false);
    for (const row of rows) {
      expect(displayWidth(row)).toBeLessThanOrEqual(80);
    }
  });
});

// ---------------------------------------------------------------------------
// Goal met (✦) — focusS >= focusTargetS and breakS within budget
// ---------------------------------------------------------------------------

describe("renderSession — goal met state", () => {
  const metState = activeState({
    focusS: 3601,     // exceeded 1h target
    totalBreakS: 100, // well within 1200s budget
  });

  it("contains ✦ prefix when goal is met", () => {
    const rows = renderSession(metState, rect(80, 24), "neon", false);
    expect(rows.join("\n")).toContain("✦");
  });
});

// ---------------------------------------------------------------------------
// displayStyle: "simple" (heavy line digits) shares block's scaling/metadata
// ---------------------------------------------------------------------------

describe("renderSession — simple display style", () => {
  const simple = activeState({ displayStyle: "simple" });

  it("returns exactly rect.height rows like block", () => {
    expect(renderSession(simple, rect(80, 24), "neon", false)).toHaveLength(24);
  });

  it("keeps metadata (goal/focus/footer) alongside the big counter", () => {
    const joined = renderSession(simple, rect(80, 24), "neon", false).join("\n");
    expect(joined).toContain("Deep work");
    expect(joined).toContain("focus");
    expect(joined).toContain("pause");
  });

  it("renders a big line-art counter (box-drawing strokes, not a tiny text line)", () => {
    // Note: a solid █ may still appear in the focus progress bar (metadata);
    // the counter glyphs themselves use box-drawing strokes — see bigfont test.
    const joined = renderSession(simple, rect(80, 24), "neon", false).join("\n");
    expect(joined).toContain("┃");
    expect(joined).toContain("━");
  });

  it("is visibly DIFFERENT from block (fixes the small/large window toggle)", () => {
    const simpleRows = renderSession(simple, rect(80, 24), "neon", false).join("\n");
    const blockRows = renderSession(activeState({ displayStyle: "block" }), rect(80, 24), "neon", false).join("\n");
    expect(simpleRows).not.toBe(blockRows);
  });

  it("all rows within width 80", () => {
    for (const row of renderSession(simple, rect(80, 24), "neon", false)) {
      expect(displayWidth(row)).toBeLessThanOrEqual(80);
    }
  });
});

// ---------------------------------------------------------------------------
// displayStyle: "outline" (hollow edge-traced block) — third selectable style
// ---------------------------------------------------------------------------

describe("renderSession — outline display style", () => {
  const outline = activeState({ displayStyle: "outline" });
  const block = activeState({ displayStyle: "block" });

  it("returns exactly rect.height rows and keeps metadata", () => {
    const rows = renderSession(outline, rect(80, 24), "neon", false);
    expect(rows).toHaveLength(24);
    const joined = rows.join("\n");
    expect(joined).toContain("Deep work");
    expect(joined).toContain("pause");
  });

  it("hollows out the block: fewer █ cells than solid block at the same size", () => {
    const outlineCount = renderSession(outline, rect(80, 24), "neon", false).join("").split("█").length - 1;
    const blockCount = renderSession(block, rect(80, 24), "neon", false).join("").split("█").length - 1;
    expect(outlineCount).toBeGreaterThan(0);
    expect(outlineCount).toBeLessThan(blockCount);
  });

  it("all rows within width 80", () => {
    for (const row of renderSession(outline, rect(80, 24), "neon", false)) {
      expect(displayWidth(row)).toBeLessThanOrEqual(80);
    }
  });
});
