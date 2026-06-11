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
    displayStyle: "block",
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

  it("keeps metadata but renders NO controls footer (deduped to the global footer)", () => {
    // The panel used to duplicate the control hints; they now live ONLY in the
    // dashboard's global footer (app.ts). The reserve-first guarantee is proven
    // by the metadata (goal + focus/break) surviving alongside the big counter,
    // while the control words are absent from the panel itself.
    const joined = rows.join("\n");
    expect(joined).toContain("Deep work");
    expect(joined).toContain("focus");
    expect(joined).not.toContain("pause");
    expect(joined).not.toContain("reset");
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

  it("shows the on-break status but no controls footer (controls in global footer)", () => {
    const joined = renderSession(breakState, rect(80, 24), "neon", false).join("\n");
    expect(joined).toContain("on break");
    expect(joined).not.toContain("resume");
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

  it("keeps centered metadata (goal/focus) alongside the big counter", () => {
    const joined = renderSession(simple, rect(80, 24), "neon", false).join("\n");
    expect(joined).toContain("Deep work");
    expect(joined).toContain("focus");
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
    expect(joined).toContain("focus");
  });

  it("renders a hollow line-art counter, distinct from the solid block", () => {
    const outlineRows = renderSession(outline, rect(80, 24), "neon", false).join("\n");
    const blockRows = renderSession(block, rect(80, 24), "neon", false).join("\n");
    // The counter glyphs differ (outline emits box-drawing strokes, not █),
    // so the whole frame is no longer identical to the block style.
    expect(outlineRows).not.toBe(blockRows);
  });

  it("all rows within width 80", () => {
    for (const row of renderSession(outline, rect(80, 24), "neon", false)) {
      expect(displayWidth(row)).toBeLessThanOrEqual(80);
    }
  });
});

// ---------------------------------------------------------------------------
// Centered layout + zen (v3.3.0)
// ---------------------------------------------------------------------------

/** Strip ANSI so we can inspect raw text + leading whitespace. */
function strip(s: string): string {
  // eslint-disable-next-line no-control-regex
  return s.replace(/\x1b\[[0-9;]*m/g, "");
}

describe("renderSession — centered goal + metadata", () => {
  // Rows include the 1-col panel border, so we measure the TEXT position:
  // centered text has substantial blank space on BOTH sides.
  it("centers the goal line", () => {
    const rows = renderSession(activeState(), rect(80, 24), "neon", false).map(strip);
    const goalRow = rows.find((r) => r.includes("Deep work"))!;
    const idx = goalRow.indexOf("Deep work");
    const after = goalRow.length - (idx + "Deep work".length);
    expect(idx).toBeGreaterThan(5);
    expect(after).toBeGreaterThan(5);
  });

  it("centers the focus progress line", () => {
    const rows = renderSession(activeState(), rect(80, 24), "neon", false).map(strip);
    const focusRow = rows.find((r) => r.includes("focus "))!;
    const idx = focusRow.indexOf("focus ");
    const after = focusRow.length - (idx + "focus ".length);
    expect(idx).toBeGreaterThan(2);
    expect(after).toBeGreaterThan(2);
  });
});

describe("renderSession — zen mode (z) hides goal + metadata", () => {
  it("hides the goal in zen mode", () => {
    const joined = renderSession(activeState({ zen: true }), rect(80, 24), "neon", false).join("\n");
    expect(joined).not.toContain("Deep work");
  });

  it("hides the focus/break metadata in zen mode", () => {
    const joined = renderSession(activeState({ zen: true }), rect(80, 24), "neon", false).join("\n");
    expect(joined).not.toContain("focus ");
    expect(joined).not.toContain("ratio");
  });

  it("still returns exactly rect.height rows and shows the counter", () => {
    const rows = renderSession(activeState({ zen: true }), rect(80, 24), "neon", false);
    expect(rows).toHaveLength(24);
    // the big counter still draws (block glyphs present)
    expect(rows.join("")).toContain("█");
  });
});

describe("renderSession — classic & bold display styles", () => {
  for (const style of ["classic", "bold"] as const) {
    it(`${style}: exact height, keeps metadata, within width`, () => {
      const rows = renderSession(activeState({ displayStyle: style }), rect(100, 30), "neon", false);
      expect(rows).toHaveLength(30);
      const joined = rows.join("\n");
      expect(joined).toContain("Deep work");
      expect(joined).toContain("focus");
      for (const row of rows) expect(displayWidth(row)).toBeLessThanOrEqual(100);
    });

    it(`${style}: counter differs from block`, () => {
      const s = renderSession(activeState({ displayStyle: style }), rect(100, 30), "neon", false).join("\n");
      const b = renderSession(activeState({ displayStyle: "block" }), rect(100, 30), "neon", false).join("\n");
      expect(s).not.toBe(b);
    });
  }
});

// ---------------------------------------------------------------------------
// Minimized window + metadata + NON-zen — the collapse bug (v3.3.1)
//
// Tall fonts (classic/bold) used to collapse straight to a one-line text clock
// when a minimized window was also showing session metadata. They must instead
// degrade gracefully to a real glyph clock (their own font once it fits, else
// the 5-row block font) while keeping the focus/break metadata visible.
// ---------------------------------------------------------------------------

describe("renderSession — tall fonts do not collapse in a minimized window", () => {
  // Time with all-distinct digits so a lone "00:12:34" text line is detectable.
  const mini = (style: SessionViewState["displayStyle"], h: number) =>
    renderSession(
      activeState({ displayStyle: style, time: "00:12:34", goal: "Flowclock" }),
      rect(62, h),
      "neon",
      false,
    ).map(strip);

  for (const style of ["classic", "bold"] as const) {
    it(`${style}: H14 with metadata renders a real glyph clock, not a text line`, () => {
      const rows = mini(style, 14);
      const joined = rows.join("\n");
      // Metadata still present (the whole point of NON-zen).
      expect(joined).toContain("focus");
      expect(joined).toContain("break");
      // A real block-glyph counter is drawn (solid blocks in the counter area).
      expect(joined).toContain("█");
      // The counter is NOT the collapsed single text line: the literal clock
      // string must NOT appear as a contiguous run.
      expect(joined).not.toContain("00:12:34");
    });

    it(`${style}: H12 (tighter) still shows a glyph clock + metadata`, () => {
      const joined = mini(style, 12).join("\n");
      expect(joined).toContain("focus");
      expect(joined).toContain("█");
      expect(joined).not.toContain("00:12:34");
    });
  }

  it("outline: H16 renders box-drawing line-art (not a collapsed single text line)", () => {
    const rows = mini("outline", 16);
    const joined = rows.join("\n");
    // Box-drawing line art must be present.
    expect(/[─│┌┐└┘]/.test(joined)).toBe(true);
    // The counter must NOT be the collapsed single text line.
    expect(joined).not.toContain("00:12:34");
  });
});

// ---------------------------------------------------------------------------
// displayStyle: "minimal" (light seven-segment line digits)
// ---------------------------------------------------------------------------

describe("renderSession — minimal display style", () => {
  const minimal = activeState({ displayStyle: "minimal" });

  it("returns exactly rect.height rows at 80×24", () => {
    expect(renderSession(minimal, rect(80, 24), "neon", false)).toHaveLength(24);
  });

  it("keeps centered metadata (goal 'Deep work' + 'focus') alongside the counter", () => {
    const joined = renderSession(minimal, rect(80, 24), "neon", false).join("\n");
    expect(joined).toContain("Deep work");
    expect(joined).toContain("focus");
  });

  it("counter differs from block", () => {
    const minimalRows = renderSession(minimal, rect(80, 24), "neon", false).join("\n");
    const blockRows = renderSession(activeState({ displayStyle: "block" }), rect(80, 24), "neon", false).join("\n");
    expect(minimalRows).not.toBe(blockRows);
  });

  it("all rows within width 80", () => {
    for (const row of renderSession(minimal, rect(80, 24), "neon", false)) {
      expect(displayWidth(row)).toBeLessThanOrEqual(80);
    }
  });
});

// ---------------------------------------------------------------------------
// uniformCounterScale: classic/bold no longer tower over block/simple/minimal
// ---------------------------------------------------------------------------

describe("renderSession — classic/bold no longer tower over block in half/minimized window", () => {
  // Before the fix, classic at scale 2 produced 18 rows of glyphs vs block's 10
  // rows — causing the goal line to be dropped. The fix caps classic/bold so
  // their rendered height is comparable to block. We verify by checking that the
  // goal text "Deep work" is still present for classic at rect(100,30).
  it("classic keeps goal text visible at rect(100,30) — not dropped by oversized counter", () => {
    const classicRows = renderSession(
      activeState({ displayStyle: "classic", goal: "Deep work" }),
      rect(100, 30),
      "neon",
      false,
    ).map(strip);
    expect(classicRows.join("\n")).toContain("Deep work");
  });

  it("bold keeps goal text visible at rect(100,30)", () => {
    const boldRows = renderSession(
      activeState({ displayStyle: "bold", goal: "Deep work" }),
      rect(100, 30),
      "neon",
      false,
    ).map(strip);
    expect(boldRows.join("\n")).toContain("Deep work");
  });

  it("classic glyph-row count is within a small delta of block at rect(100,30)", () => {
    // block/classic/bold all draw solid █ counters; detecting █ isolates the
    // counter rows (the panel border is │, and the only other █ — the focus
    // progress bar — lives on a row containing "focus", which we exclude).
    const isGlyphRow = (r: string) =>
      /█/.test(r) &&
      !/focus|break|Flowclock|Session|Deep work/.test(r);

    const blockCount = renderSession(
      activeState({ displayStyle: "block" }),
      rect(100, 30),
      "neon",
      false,
    ).map(strip).filter(isGlyphRow).length;

    const classicCount = renderSession(
      activeState({ displayStyle: "classic" }),
      rect(100, 30),
      "neon",
      false,
    ).map(strip).filter(isGlyphRow).length;

    // With the fix, classic should be within 3 rows of block (both ~9-10 rows).
    // Before the fix, classic was ~18 rows vs block ~10 — a delta of 8.
    expect(Math.abs(classicCount - blockCount)).toBeLessThanOrEqual(3);
  });
});
