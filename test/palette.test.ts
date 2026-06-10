import { describe, it, expect } from "vitest";

import {
  PALETTE_COMMANDS,
  emptyPaletteState,
  filterCommands,
  paletteApplyKey,
  renderPalette,
} from "../src/tui/palette.js";
import type { PaletteState } from "../src/tui/palette.js";
import { displayWidth } from "../src/lib/tui/draw.js";

// ---------------------------------------------------------------------------
// filterCommands
// ---------------------------------------------------------------------------

describe("filterCommands", () => {
  it("empty query returns all commands (stable order)", () => {
    const result = filterCommands("");
    expect(result).toHaveLength(PALETTE_COMMANDS.length);
    expect(result.map((c) => c.name)).toEqual(PALETTE_COMMANDS.map((c) => c.name));
  });

  it("whitespace-only query returns all commands", () => {
    const result = filterCommands("   ");
    expect(result).toHaveLength(PALETTE_COMMANDS.length);
  });

  it("matches by substring in name", () => {
    // "the" matches "theme" by name substring
    const result = filterCommands("the", PALETTE_COMMANDS);
    expect(result.some((c) => c.name === "theme")).toBe(true);
  });

  it("matches by substring in summary", () => {
    // "markdown" matches "summary" command whose summary contains "markdown"
    const result = filterCommands("markdown", PALETTE_COMMANDS);
    expect(result.some((c) => c.name === "summary")).toBe(true);
  });

  it("is case-insensitive (THEME matches theme)", () => {
    const result = filterCommands("THEME", PALETTE_COMMANDS);
    expect(result.some((c) => c.name === "theme")).toBe(true);
  });

  it("returns empty array when no command matches", () => {
    const result = filterCommands("xyzzy_no_match_ever");
    expect(result).toHaveLength(0);
  });

  it("uses PALETTE_COMMANDS by default", () => {
    const withDefault = filterCommands("");
    const withExplicit = filterCommands("", PALETTE_COMMANDS);
    expect(withDefault).toEqual(withExplicit);
  });

  it("custom command list is filtered correctly", () => {
    const custom = [
      { name: "foo", summary: "does foo things" },
      { name: "bar", summary: "does bar things" },
    ];
    expect(filterCommands("foo", custom)).toHaveLength(1);
    expect(filterCommands("things", custom)).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// paletteApplyKey — char appends to query, resets selected to 0
// ---------------------------------------------------------------------------

describe("paletteApplyKey — char", () => {
  it("appends a printable char to the query", () => {
    const state: PaletteState = { open: true, query: "se", selected: 1 };
    const { state: next } = paletteApplyKey(state, { name: "char", char: "s" });
    expect(next.query).toBe("ses");
  });

  it("resets selected to 0 when a char is appended", () => {
    const state: PaletteState = { open: true, query: "s", selected: 3 };
    const { state: next } = paletteApplyKey(state, { name: "char", char: "e" });
    expect(next.selected).toBe(0);
  });

  it("does not mutate the input state object", () => {
    const state = Object.freeze({ open: true, query: "a", selected: 0 });
    // Should not throw despite frozen input
    const { state: next } = paletteApplyKey(state, { name: "char", char: "b" });
    expect(next).not.toBe(state);
    expect(next.query).toBe("ab");
  });

  it("ignores Ctrl-C (non-printable)", () => {
    const state: PaletteState = { open: true, query: "q", selected: 0 };
    const { state: next, action } = paletteApplyKey(state, { name: "char", char: "\x03" });
    expect(next.query).toBe("q"); // unchanged
    expect(action).toBeUndefined();
  });

  it("ignores non-printable char (code < 0x20)", () => {
    const state: PaletteState = { open: true, query: "q", selected: 0 };
    const { state: next } = paletteApplyKey(state, { name: "char", char: "\x01" });
    expect(next.query).toBe("q");
  });
});

// ---------------------------------------------------------------------------
// paletteApplyKey — backspace
// ---------------------------------------------------------------------------

describe("paletteApplyKey — backspace", () => {
  it("removes the last character from the query", () => {
    const state: PaletteState = { open: true, query: "ses", selected: 0 };
    const { state: next } = paletteApplyKey(state, { name: "backspace" });
    expect(next.query).toBe("se");
  });

  it("resets selected to 0 after backspace", () => {
    const state: PaletteState = { open: true, query: "se", selected: 2 };
    const { state: next } = paletteApplyKey(state, { name: "backspace" });
    expect(next.selected).toBe(0);
  });

  it("does not go below empty string", () => {
    const state: PaletteState = { open: true, query: "", selected: 0 };
    const { state: next } = paletteApplyKey(state, { name: "backspace" });
    expect(next.query).toBe("");
  });

  it("does not mutate the input state object", () => {
    const state = Object.freeze({ open: true, query: "ab", selected: 0 });
    const { state: next } = paletteApplyKey(state, { name: "backspace" });
    expect(next).not.toBe(state);
  });
});

// ---------------------------------------------------------------------------
// paletteApplyKey — up / down navigation
// ---------------------------------------------------------------------------

describe("paletteApplyKey — up/down navigation", () => {
  it("down moves selected from 0 to 1", () => {
    const state: PaletteState = { open: true, query: "", selected: 0 };
    const { state: next } = paletteApplyKey(state, { name: "down" });
    expect(next.selected).toBe(1);
  });

  it("down then down increments selected by 2", () => {
    const state: PaletteState = { open: true, query: "", selected: 0 };
    const { state: s1 } = paletteApplyKey(state, { name: "down" });
    const { state: s2 } = paletteApplyKey(s1, { name: "down" });
    expect(s2.selected).toBe(2);
  });

  it("down clamps within filtered length", () => {
    // Use a query that matches exactly 2 commands
    const state: PaletteState = { open: true, query: "session", selected: 1 };
    // filtered for "session" matches "session" and "sessions" (2 results, index 0 and 1)
    // selected is already at 1 (last). down should not go past index 1.
    const { state: next } = paletteApplyKey(state, { name: "down" });
    const filtered = filterCommands("session");
    expect(next.selected).toBeLessThanOrEqual(filtered.length - 1);
  });

  it("up clamps at 0", () => {
    const state: PaletteState = { open: true, query: "", selected: 0 };
    const { state: next } = paletteApplyKey(state, { name: "up" });
    expect(next.selected).toBe(0);
  });

  it("up decrements selected by 1", () => {
    const state: PaletteState = { open: true, query: "", selected: 3 };
    const { state: next } = paletteApplyKey(state, { name: "up" });
    expect(next.selected).toBe(2);
  });

  it("down stays at 0 when filtered is empty", () => {
    const state: PaletteState = { open: true, query: "xyzzy_no_match", selected: 0 };
    const { state: next } = paletteApplyKey(state, { name: "down" });
    expect(next.selected).toBe(0);
  });

  it("does not mutate the input state", () => {
    const state = Object.freeze({ open: true, query: "", selected: 2 });
    const { state: next } = paletteApplyKey(state, { name: "up" });
    expect(next).not.toBe(state);
  });
});

// ---------------------------------------------------------------------------
// paletteApplyKey — enter
// ---------------------------------------------------------------------------

describe("paletteApplyKey — enter", () => {
  it("returns action.type=run with the selected command name", () => {
    // "" query → all commands visible; selected=0 → first command
    const state: PaletteState = { open: true, query: "", selected: 0 };
    const { state: next, action } = paletteApplyKey(state, { name: "enter" });
    expect(action).toBeDefined();
    expect(action?.type).toBe("run");
    if (action?.type === "run") {
      expect(action.command).toBe(PALETTE_COMMANDS[0]!.name);
    }
    expect(next.open).toBe(false);
    expect(next.query).toBe("");
    expect(next.selected).toBe(0);
  });

  it("run command corresponds to the filtered+selected entry", () => {
    // Filter to "theme" only
    const state: PaletteState = { open: true, query: "theme", selected: 0 };
    const { action } = paletteApplyKey(state, { name: "enter" });
    expect(action?.type).toBe("run");
    if (action?.type === "run") {
      expect(action.command).toBe("theme");
    }
  });

  it("does nothing when filtered is empty", () => {
    const state: PaletteState = { open: true, query: "xyzzy_no_match_ever", selected: 0 };
    const { state: next, action } = paletteApplyKey(state, { name: "enter" });
    // State should be effectively unchanged (open remains true, no action)
    expect(action).toBeUndefined();
    expect(next.open).toBe(true);
  });

  it("does not mutate the input state", () => {
    const state = Object.freeze({ open: true, query: "quit", selected: 0 });
    const { state: next } = paletteApplyKey(state, { name: "enter" });
    expect(next).not.toBe(state);
  });
});

// ---------------------------------------------------------------------------
// paletteApplyKey — escape
// ---------------------------------------------------------------------------

describe("paletteApplyKey — escape", () => {
  it("returns action.type=close", () => {
    const state: PaletteState = { open: true, query: "foo", selected: 2 };
    const { action } = paletteApplyKey(state, { name: "escape" });
    expect(action?.type).toBe("close");
  });

  it("sets open=false", () => {
    const state: PaletteState = { open: true, query: "foo", selected: 2 };
    const { state: next } = paletteApplyKey(state, { name: "escape" });
    expect(next.open).toBe(false);
  });

  it("resets query and selected to defaults", () => {
    const state: PaletteState = { open: true, query: "foo", selected: 2 };
    const { state: next } = paletteApplyKey(state, { name: "escape" });
    expect(next.query).toBe("");
    expect(next.selected).toBe(0);
  });

  it("does not mutate the input state", () => {
    const state = Object.freeze({ open: true, query: "bar", selected: 1 });
    const { state: next } = paletteApplyKey(state, { name: "escape" });
    expect(next).not.toBe(state);
  });
});

// ---------------------------------------------------------------------------
// renderPalette
// ---------------------------------------------------------------------------

describe("renderPalette", () => {
  const COLS = 80;
  const ROWS = 24;

  it("returns an overlay with rows, top, left", () => {
    const state: PaletteState = { open: true, query: "", selected: 0 };
    const overlay = renderPalette(state, COLS, ROWS, "neon", false);
    expect(overlay).toHaveProperty("rows");
    expect(overlay).toHaveProperty("top");
    expect(overlay).toHaveProperty("left");
  });

  it("top >= 0 and left >= 0", () => {
    const state: PaletteState = { open: true, query: "", selected: 0 };
    const overlay = renderPalette(state, COLS, ROWS, "neon", false);
    expect(overlay.top).toBeGreaterThanOrEqual(0);
    expect(overlay.left).toBeGreaterThanOrEqual(0);
  });

  it("rows.length === boxHeight", () => {
    const state: PaletteState = { open: true, query: "", selected: 0 };
    const filtered = filterCommands("");
    const boxWidth = Math.min(50, Math.max(20, COLS - 4));
    const visibleCount = Math.min(filtered.length, Math.max(1, ROWS - 6));
    const boxHeight = visibleCount + 3;
    const overlay = renderPalette(state, COLS, ROWS, "neon", false);
    expect(overlay.rows).toHaveLength(boxHeight);
    void boxWidth; // used in width check below
  });

  it("every row has displayWidth <= boxWidth", () => {
    const state: PaletteState = { open: true, query: "", selected: 0 };
    const boxWidth = Math.min(50, Math.max(20, COLS - 4));
    const overlay = renderPalette(state, COLS, ROWS, "neon", false);
    for (const row of overlay.rows) {
      expect(displayWidth(row)).toBeLessThanOrEqual(boxWidth);
    }
  });

  it("every row has displayWidth === boxWidth (panel pads to exact width)", () => {
    const state: PaletteState = { open: true, query: "", selected: 0 };
    const boxWidth = Math.min(50, Math.max(20, COLS - 4));
    const overlay = renderPalette(state, COLS, ROWS, "neon", false);
    for (const row of overlay.rows) {
      expect(displayWidth(row)).toBe(boxWidth);
    }
  });

  it("color:true does not throw", () => {
    const state: PaletteState = { open: true, query: "", selected: 0 };
    expect(() => renderPalette(state, COLS, ROWS, "neon", true)).not.toThrow();
  });

  it("color:true also does not throw for other themes", () => {
    const state: PaletteState = { open: true, query: "s", selected: 0 };
    for (const theme of ["neon", "amber", "blue", "mono"] as const) {
      expect(() => renderPalette(state, COLS, ROWS, theme, true)).not.toThrow();
    }
  });

  it("works when query narrows to a single match", () => {
    const state: PaletteState = { open: true, query: "quit", selected: 0 };
    const overlay = renderPalette(state, COLS, ROWS, "neon", false);
    // visibleCount=1, boxHeight=4
    expect(overlay.rows).toHaveLength(4);
  });

  it("works with a very small terminal (min box dimensions)", () => {
    const state: PaletteState = { open: true, query: "", selected: 0 };
    expect(() => renderPalette(state, 24, 10, "mono", false)).not.toThrow();
    const overlay = renderPalette(state, 24, 10, "mono", false);
    expect(overlay.top).toBeGreaterThanOrEqual(0);
    expect(overlay.left).toBeGreaterThanOrEqual(0);
  });

  it("panel title contains 'Commands'", () => {
    const state: PaletteState = { open: true, query: "", selected: 0 };
    const overlay = renderPalette(state, COLS, ROWS, "neon", false);
    // First row (top border) should contain the title
    const firstRow = overlay.rows[0] ?? "";
    // Strip ANSI for inspection
    // eslint-disable-next-line no-control-regex
    const plain = firstRow.replace(/\x1b(?:\[[0-9;]*[A-Za-z]|\][^\x07\x1b]*(?:\x07|\x1b\\))/g, "");
    expect(plain).toContain("Commands");
  });

  it("body line 0 contains the query cursor marker ▏", () => {
    const state: PaletteState = { open: true, query: "foo", selected: 0 };
    const overlay = renderPalette(state, COLS, ROWS, "neon", false);
    // body line 0 is overlay row 1 (row 0 is top border)
    const bodyLine = overlay.rows[1] ?? "";
    expect(bodyLine).toContain("▏");
    expect(bodyLine).toContain("foo");
  });

  it("emptyPaletteState returns { open:false, query:'', selected:0 }", () => {
    expect(emptyPaletteState()).toEqual({ open: false, query: "", selected: 0 });
  });

  it("includes a 'display' command to toggle display style", () => {
    const display = PALETTE_COMMANDS.find((c) => c.name === "display");
    expect(display).toBeDefined();
    expect(display!.summary.toLowerCase()).toContain("display style");
  });

  it("filters to 'display' when searching 'display'", () => {
    expect(filterCommands("display").some((c) => c.name === "display")).toBe(true);
  });

  it("the 'start' command advertises the form", () => {
    const start = PALETTE_COMMANDS.find((c) => c.name === "start");
    expect(start!.summary.toLowerCase()).toContain("form");
  });
});
