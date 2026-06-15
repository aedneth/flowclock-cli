/**
 * Break-category picker — a pure, self-contained transient overlay for the live
 * session view. It lets the user pick any category from ALL_BREAK_CATEGORIES
 * (the "more" picker that unlocks coffee/sleep beyond the 1–6 quick keys).
 *
 * Mirrors the confirm/palette design: types + pure functions only, no I/O. The
 * caller (app.ts) wires the action that runs on pick/cancel.
 */

import type { Key } from "../lib/tui/input.js";
import type { ThemeName } from "../schemas/config.js";
import { panel, padTo, truncate } from "../lib/tui/draw.js";
import { paint, THEME_FG } from "../lib/theme.js";
import { ALL_BREAK_CATEGORIES } from "../schemas/session.js";
import type { BreakCategory } from "../schemas/session.js";

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

export interface BreakPickerState {
  open: boolean;
  index: number;
}

/** Canonical empty / closed picker state. */
export function emptyBreakPickerState(): BreakPickerState {
  return { open: false, index: 0 };
}

/**
 * Open the picker, seeding the selection at `current` if it is a known
 * category. Falls back to index 0 when `current` is undefined or unknown.
 */
export function openBreakPickerState(current?: BreakCategory): BreakPickerState {
  const found = current === undefined ? -1 : ALL_BREAK_CATEGORIES.indexOf(current);
  return { open: true, index: Math.max(0, found) };
}

// ---------------------------------------------------------------------------
// Reducer
// ---------------------------------------------------------------------------

export interface BreakPickerResult {
  state: BreakPickerState;
  action?: { type: "pick"; category: BreakCategory } | { type: "cancel" };
}

/**
 * Pure reducer — never mutates `state`.
 *
 *   up / k     → move selection up (wraps)
 *   down / j   → move selection down (wraps)
 *   enter      → pick the indexed category, close
 *   escape     → cancel, close
 *   1..8       → directly pick that category (1-based) if in range
 *   anything else → no change
 */
export function breakPickerApplyKey(state: BreakPickerState, key: Key): BreakPickerResult {
  const n = ALL_BREAK_CATEGORIES.length;

  if (key.name === "up" || (key.name === "char" && key.char === "k")) {
    return { state: { ...state, index: (state.index - 1 + n) % n } };
  }
  if (key.name === "down" || (key.name === "char" && key.char === "j")) {
    return { state: { ...state, index: (state.index + 1) % n } };
  }
  if (key.name === "enter") {
    return {
      state: emptyBreakPickerState(),
      action: { type: "pick", category: ALL_BREAK_CATEGORIES[state.index]! },
    };
  }
  if (key.name === "escape") {
    return { state: emptyBreakPickerState(), action: { type: "cancel" } };
  }
  if (key.name === "char" && key.char >= "1" && key.char <= "8") {
    const idx = key.char.charCodeAt(0) - "1".charCodeAt(0); // 0-based
    if (idx >= 0 && idx < n) {
      return {
        state: emptyBreakPickerState(),
        action: { type: "pick", category: ALL_BREAK_CATEGORIES[idx]! },
      };
    }
    return { state };
  }

  return { state };
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

export interface BreakPickerOverlay {
  rows: string[];
  top: number;
  left: number;
}

/** Render the break-category picker as a centered bordered panel. */
export function renderBreakPicker(
  state: BreakPickerState,
  cols: number,
  rows: number,
  theme: ThemeName,
  color: boolean,
): BreakPickerOverlay {
  const boxWidth = Math.min(54, Math.max(30, cols - 4));
  const innerW = boxWidth - 2;

  const n = ALL_BREAK_CATEGORIES.length;
  const clampedIndex = Math.max(0, Math.min(state.index, n - 1));

  const body: string[] = [];

  for (let i = 0; i < n; i++) {
    const category = ALL_BREAK_CATEGORIES[i]!;
    const num = i + 1; // 1-based
    const isActive = i === clampedIndex;

    let line: string;
    if (isActive) {
      const text = truncate(`› ${num} ${category}`, innerW);
      line = color ? paint(text, theme, true) : text;
    } else {
      line = truncate(`  ${num} ${category}`, innerW);
    }
    body.push(line);
  }

  body.push(padTo("", innerW));
  body.push(truncate("[↑↓] select · [1-8] pick · [Enter] choose · [Esc] cancel", innerW));

  const boxHeight = body.length + 2; // 2 borders

  const panelRows = panel({
    title: "Break category",
    width: boxWidth,
    height: boxHeight,
    body,
    color: color ? THEME_FG[theme] : undefined,
  });

  const left = Math.max(0, Math.floor((cols - boxWidth) / 2));
  const top = Math.max(0, Math.floor((rows - boxHeight) / 2));

  return { rows: panelRows, top, left };
}
