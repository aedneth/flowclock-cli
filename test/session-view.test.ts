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

/** Strip ANSI so we can inspect raw text + leading whitespace. */
function strip(s: string): string {
  // eslint-disable-next-line no-control-regex
  return s.replace(/\x1b\[[0-9;]*m/g, "");
}

/**
 * Count "pure glyph rows": lines where every non-space character (ignoring the
 * panel border │ that wraps each row) belongs to the given ink set. This correctly
 * ignores the progress bar (▕██████████▏) and panel borders (single-line
 * box-drawing), making it reliable for block/classic/bold whose inks (█ ▒ ▓)
 * never appear in panel borders.
 *
 * The panel border renders as │...content...│ on each inner row, so we strip
 * the leading and trailing │ before checking the ink constraint.
 */
function glyphRows(lines: string[], inks: string[]): number {
  return lines.filter((l) => {
    // Strip panel border │ from both ends, then trim spaces.
    const stripped = l.replace(/^[│┌┐└┘─\s]+/, "").replace(/[│┌┐└┘─\s]+$/, "");
    if (!stripped) return false;
    return [...stripped].every((ch) => ch === " " || inks.includes(ch));
  }).length;
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
// Classic/bold now share block's 5-row footprint, so they render their own
// ink (▒ / ▓) in a minimized window with metadata — never falling back to
// block's █ glyphs and never collapsing to a bare text line.
// ---------------------------------------------------------------------------

describe("renderSession — classic/bold render own ink in a minimized window (no fallback)", () => {
  // Time with all-distinct digits so a lone "00:12:34" text line is detectable.
  const mini = (style: SessionViewState["displayStyle"], h: number) =>
    renderSession(
      activeState({ displayStyle: style, time: "00:12:34", goal: "Flowclock" }),
      rect(62, h),
      "neon",
      false,
    ).map(strip);

  it("classic: H14 renders ▒ glyphs (its own ink), not █ or bare text", () => {
    const rows = mini("classic", 14);
    const joined = rows.join("\n");
    // Metadata still present (the whole point of NON-zen).
    expect(joined).toContain("focus");
    expect(joined).toContain("break");
    // Classic renders its own shade ink ▒, NOT block's █.
    expect(joined).toContain("▒");
    // The counter is NOT the collapsed single text line.
    expect(joined).not.toContain("00:12:34");
  });

  it("classic: H12 (tighter) still shows ▒ glyphs + metadata (no fallback to block)", () => {
    const joined = mini("classic", 12).join("\n");
    expect(joined).toContain("focus");
    expect(joined).toContain("▒");
    expect(joined).not.toContain("00:12:34");
  });

  it("bold: H14 renders ▓ glyphs (its own ink), not █ or bare text", () => {
    const rows = mini("bold", 14);
    const joined = rows.join("\n");
    expect(joined).toContain("focus");
    expect(joined).toContain("break");
    // Bold renders its own shade ink ▓, NOT block's █.
    expect(joined).toContain("▓");
    expect(joined).not.toContain("00:12:34");
  });

  it("bold: H12 (tighter) still shows ▓ glyphs + metadata (no fallback to block)", () => {
    const joined = mini("bold", 12).join("\n");
    expect(joined).toContain("focus");
    expect(joined).toContain("▓");
    expect(joined).not.toContain("00:12:34");
  });

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
// v3.5 — classic/bold share block's footprint (Bug 1 + Bug 2 regression guards
//         updated to reflect the new shade-weight design)
// ---------------------------------------------------------------------------

describe("v3.5 — classic/bold share block's 5-row footprint (uniform counter)", () => {
  // State used for all sub-tests: active session with goal, focus target, and
  // break budget, no zen mode.
  const state34 = (style: SessionViewState["displayStyle"]): SessionViewState =>
    activeState({
      displayStyle: style,
      active: true,
      goal: "Deep work",
      focusTargetS: 1200,
      breakBudgetS: 300,
      zen: false,
    });

  // ── Test A: classic/bold glyph rows EXACTLY EQUAL block's — not just "close" ──

  it("Test A — classic: ▒ glyph rows EXACTLY equal block's █ glyph rows in a tight 92×17 window", () => {
    const w = 92, h = 17;
    const r = rect(w, h);

    // Pure glyph rows: every non-space char must be the style's ink.
    const blockRows = renderSession(state34("block"), r, "neon", false).map(strip);
    const classicRows = renderSession(state34("classic"), r, "neon", false).map(strip);

    const blockCount = glyphRows(blockRows, ["█"]);
    const classicCount = glyphRows(classicRows, ["▒"]);

    // Exact footprint parity — delta must be 0.
    expect(classicCount).toBe(blockCount);
    // Classic must render at least 1 row of its own ▒ ink (no fallback to block).
    expect(classicCount).toBeGreaterThanOrEqual(1);
  });

  it("Test A — bold: ▓ glyph rows EXACTLY equal block's █ glyph rows in a tight 92×17 window", () => {
    const w = 92, h = 17;
    const r = rect(w, h);

    const blockRows = renderSession(state34("block"), r, "neon", false).map(strip);
    const boldRows = renderSession(state34("bold"), r, "neon", false).map(strip);

    const blockCount = glyphRows(blockRows, ["█"]);
    const boldCount = glyphRows(boldRows, ["▓"]);

    expect(boldCount).toBe(blockCount);
    expect(boldCount).toBeGreaterThanOrEqual(1);
  });

  // ── Test B: goal shown consistently across ALL six styles ──

  it("Test B — goal 'Deep work' is present for all six styles in a tight 92×17 window", () => {
    const w = 92, h = 17;
    const r = rect(w, h);
    for (const style of ["block", "simple", "outline", "minimal", "classic", "bold"] as const) {
      const joined = renderSession(state34(style), r, "neon", false).map(strip).join("\n");
      expect(joined, `goal missing for style "${style}"`).toContain("Deep work");
    }
  });

  // ── Test C: outline shows double-line chars; minimal uses single-line only ──

  it("Test C — outline renders double-line box-drawing chars (╔/║/╚) that minimal never does", () => {
    const w = 92, h = 17;
    const r = rect(w, h);

    // Strip ANSI but NOT the box-drawing characters themselves.
    const outlineJoined = renderSession(state34("outline"), r, "neon", false)
      .map(strip)
      .join("\n");
    const minimalJoined = renderSession(state34("minimal"), r, "neon", false)
      .map(strip)
      .join("\n");

    // Outline counter must contain at least one double-line char.
    expect(/[╔║╚╗╝═]/.test(outlineJoined)).toBe(true);
    // Minimal counter must NOT contain any double-line chars.
    expect(/[╔║╚╗╝═]/.test(minimalJoined)).toBe(false);
  });

  // ── Test D: roomy window — classic renders ▒ (own ink) at same footprint as block ──
  // REPLACED: classic is now a 5-row shade font, never "tall" (> 5 glyph rows).
  // This test verifies classic renders its own ▒ ink (not █) at the same glyph-row
  // footprint as block in a roomy 92×28 window, with goal + % visible.

  it("Test D — classic renders ▒ (own ink, not █) at the same glyph-row footprint as block in a roomy 92×28 window, goal + % present", () => {
    const w = 92, h = 28;
    const r = rect(w, h);

    const classicRendered = renderSession(state34("classic"), r, "neon", false);
    const blockRendered = renderSession(state34("block"), r, "neon", false);

    const classicStripped = classicRendered.map(strip);
    const blockStripped = blockRendered.map(strip);
    const classicJoined = classicStripped.join("\n");

    // Glyph row parity: classic's ▒ rows == block's █ rows.
    const classicGlyphCount = glyphRows(classicStripped, ["▒"]);
    const blockGlyphCount = glyphRows(blockStripped, ["█"]);
    expect(classicGlyphCount).toBe(blockGlyphCount);

    // Classic inks with ▒ in its glyph rows — must have at least 1.
    expect(classicGlyphCount).toBeGreaterThanOrEqual(1);
    // Joined content of classic's output must contain ▒.
    expect(classicJoined).toContain("▒");

    // Goal and focus-% metadata must both survive alongside the counter.
    expect(classicJoined).toContain("Deep work");
    expect(classicJoined).toContain("%");
  });

  // ── NEW guard: tight minimized window — classic/bold use their own ink, never fall back to block ──

  it("NEW — classic renders ▒ and NOT █ in glyph rows in a tight 84×17 window, goal present", () => {
    const r = rect(84, 17);
    const st = activeState({
      displayStyle: "classic",
      goal: "Guard test",
      focusTargetS: 1200,
      breakBudgetS: 300,
      zen: false,
    });
    const rows = renderSession(st, r, "neon", false).map(strip);
    const joined = rows.join("\n");

    // Classic must use its own ▒ ink.
    expect(joined).toContain("▒");
    // Goal must survive.
    expect(joined).toContain("Guard test");

    // No pure glyph row should contain █ — classic never falls back to block ink.
    const blockGlyphRows = rows.filter((l) => {
      const t = l.trim();
      return t && [...t].every((ch) => ch === " " || ch === "█");
    });
    expect(blockGlyphRows).toHaveLength(0);
  });

  it("NEW — bold renders ▓ and NOT █ in glyph rows in a tight 84×17 window, goal present", () => {
    const r = rect(84, 17);
    const st = activeState({
      displayStyle: "bold",
      goal: "Guard test",
      focusTargetS: 1200,
      breakBudgetS: 300,
      zen: false,
    });
    const rows = renderSession(st, r, "neon", false).map(strip);
    const joined = rows.join("\n");

    // Bold must use its own ▓ ink.
    expect(joined).toContain("▓");
    // Goal must survive.
    expect(joined).toContain("Guard test");

    // No pure glyph row should contain █ — bold never falls back to block ink.
    const blockGlyphRows = rows.filter((l) => {
      const t = l.trim();
      return t && [...t].every((ch) => ch === " " || ch === "█");
    });
    expect(blockGlyphRows).toHaveLength(0);
  });
});
