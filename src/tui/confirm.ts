/**
 * Confirmation modal — a pure, self-contained transient overlay for
 * destructive actions (e.g. deleting a session). Mirrors the palette's design:
 * types + pure functions only, no I/O. The caller (app.ts) wires the action
 * that runs on confirm and carries an opaque `payload` (e.g. a session id).
 *
 * Safety: only an explicit `y` confirms; `n`, `Esc` and `Enter` all CANCEL, so
 * an accidental Enter never deletes anything.
 */

import type { Key } from "../lib/tui/input.js";
import type { ThemeName } from "../schemas/config.js";
import { panel, padTo, truncate } from "../lib/tui/draw.js";
import { THEME_FG } from "../lib/theme.js";

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

export interface ConfirmState {
  open: boolean;
  title: string;
  message: string;
  /** Opaque value the caller acts on when confirmed (e.g. a session id). */
  payload: string | null;
}

/** Canonical empty / closed confirm state. */
export function emptyConfirmState(): ConfirmState {
  return { open: false, title: "", message: "", payload: null };
}

/** Open a confirm modal with a title, message and opaque payload. */
export function openConfirmState(opts: {
  title: string;
  message: string;
  payload: string;
}): ConfirmState {
  return { open: true, ...opts };
}

// ---------------------------------------------------------------------------
// Reducer
// ---------------------------------------------------------------------------

export interface ConfirmResult {
  state: ConfirmState;
  action?: { type: "confirm"; payload: string | null } | { type: "cancel" };
}

/**
 * Pure reducer — never mutates `state`.
 *
 *   y            → confirm (carries the payload)
 *   n / Esc / Enter → cancel (safe default — Enter never confirms)
 *   anything else → no change (modal stays open)
 */
export function confirmApplyKey(state: ConfirmState, key: Key): ConfirmResult {
  if (key.name === "char" && key.char.toLowerCase() === "y") {
    return { state: emptyConfirmState(), action: { type: "confirm", payload: state.payload } };
  }
  if (
    key.name === "escape" ||
    key.name === "enter" ||
    (key.name === "char" && key.char.toLowerCase() === "n")
  ) {
    return { state: emptyConfirmState(), action: { type: "cancel" } };
  }
  return { state };
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

export interface ConfirmOverlay {
  rows: string[];
  top: number;
  left: number;
}

/** Render the confirm modal as a centered bordered panel. */
export function renderConfirm(
  state: ConfirmState,
  cols: number,
  rows: number,
  theme: ThemeName,
  color: boolean,
): ConfirmOverlay {
  const boxWidth = Math.min(54, Math.max(30, cols - 4));
  const innerW = boxWidth - 2;

  const body: string[] = [];
  body.push(truncate(state.message, innerW));
  body.push(padTo("", innerW));
  body.push(truncate("[y] confirm · [n] cancel", innerW));

  const boxHeight = body.length + 2; // 2 borders

  const panelRows = panel({
    title: state.title,
    width: boxWidth,
    height: boxHeight,
    body,
    color: color ? THEME_FG[theme] : undefined,
  });

  const left = Math.max(0, Math.floor((cols - boxWidth) / 2));
  const top = Math.max(0, Math.floor((rows - boxHeight) / 2));

  return { rows: panelRows, top, left };
}
