/**
 * Resume-previous-session overlay — a pure, self-contained transient overlay
 * shown at dashboard launch when a prior session was found unfinished (the
 * process crashed or froze mid-session). It reports what would be restored and
 * asks the user to resume or discard. Mirrors the confirm modal's design:
 * types + pure functions only, no I/O. The caller (app.ts) does the actual
 * restore; this module only reports the user's choice.
 *
 * Safety: Enter defaults to the safe, non-destructive choice (resume), so an
 * accidental Enter never discards recovered work. `Esc` and `d` discard.
 */

import type { Key } from "../lib/tui/input.js";
import type { ThemeName } from "../schemas/config.js";
import { panel, padTo, truncate } from "../lib/tui/draw.js";
import { THEME_FG } from "../lib/theme.js";
import { humanDuration } from "../lib/format.js";

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

/** Summary of the recovered session that would be restored. */
export interface ResumeInfo {
  goal: string | null;
  label: string | null;
  focusS: number;
  breakS: number;
  heartbeatISO: string;
}

export interface ResumeState {
  open: boolean;
  info: ResumeInfo | null;
}

/** Canonical empty / closed resume state. */
export function emptyResumeState(): ResumeState {
  return { open: false, info: null };
}

/** Open the resume overlay with the recovered session summary. */
export function openResumeState(info: ResumeInfo): ResumeState {
  return { open: true, info };
}

// ---------------------------------------------------------------------------
// Reducer
// ---------------------------------------------------------------------------

export interface ResumeResult {
  state: ResumeState;
  action?: { type: "resume" } | { type: "discard" };
}

/**
 * Pure reducer — never mutates `state`.
 *
 *   r            → resume (restore the recovered session)
 *   d / Esc      → discard (drop the recovered session)
 *   Enter        → resume (safe default — Enter never discards)
 *   anything else → no change (overlay stays open)
 */
export function resumeApplyKey(state: ResumeState, key: Key): ResumeResult {
  if (key.name === "char" && key.char.toLowerCase() === "r") {
    return { state: emptyResumeState(), action: { type: "resume" } };
  }
  if (key.name === "enter") {
    return { state: emptyResumeState(), action: { type: "resume" } };
  }
  if (
    key.name === "escape" ||
    (key.name === "char" && key.char.toLowerCase() === "d")
  ) {
    return { state: emptyResumeState(), action: { type: "discard" } };
  }
  return { state };
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

export interface ResumeOverlay {
  rows: string[];
  top: number;
  left: number;
}

/** Render the resume overlay as a centered bordered panel. */
export function renderResume(
  state: ResumeState,
  cols: number,
  rows: number,
  theme: ThemeName,
  color: boolean,
): ResumeOverlay {
  const boxWidth = Math.min(54, Math.max(30, cols - 4));
  const innerW = boxWidth - 2;

  const body: string[] = [];
  const info = state.info;

  if (info === null) {
    body.push(padTo("", innerW));
  } else {
    body.push(truncate("A session was interrupted:", innerW));
    body.push(truncate("  " + (info.goal ?? "(no goal)"), innerW));
    if (info.label !== null) {
      body.push(truncate("  details: " + info.label, innerW));
    }
    body.push(padTo("", innerW));
    body.push(truncate("  focus  " + humanDuration(info.focusS), innerW));
    body.push(truncate("  break  " + humanDuration(info.breakS), innerW));
    body.push(padTo("", innerW));
    body.push(truncate("[r] resume · [d] discard · [Esc] discard", innerW));
  }

  const boxHeight = body.length + 2; // 2 borders

  const panelRows = panel({
    title: "Resume previous session?",
    width: boxWidth,
    height: boxHeight,
    body,
    color: color ? THEME_FG[theme] : undefined,
  });

  const left = Math.max(0, Math.floor((cols - boxWidth) / 2));
  const top = Math.max(0, Math.floor((rows - boxHeight) / 2));

  return { rows: panelRows, top, left };
}
