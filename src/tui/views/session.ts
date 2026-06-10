/**
 * Session view — the HERO live-counter panel for the TUI dashboard.
 *
 * Layout philosophy: RESERVE metadata/footer space first, then scale the
 * big-font counter into what remains. This prevents the counter from growing
 * so large that it crowds out the progress lines and footer controls.
 *
 * Pure function: no I/O, no side effects.
 */

import type { Rect } from "../../lib/tui/layout.js";
import type { ThemeName } from "../../schemas/config.js";
import type { BreakCategory } from "../../schemas/session.js";
import { panel, padTo, displayWidth } from "../../lib/tui/draw.js";
import { barH } from "../../lib/tui/draw.js";
import { paint, THEME_FG } from "../../lib/theme.js";
import { humanDuration } from "../../lib/format.js";
import { breakRatio } from "../../lib/flowtime.js";
import {
  renderBigLines,
  renderOutlineLines,
  bigWidth,
  BIG_ROWS,
  computeSessionScale,
} from "../../lib/bigfont.js";
import type { DisplayStyle } from "../../schemas/config.js";

// ---------------------------------------------------------------------------
// Public interface
// ---------------------------------------------------------------------------

export interface SessionViewState {
  active: boolean;                 // is a session currently running?
  time: string;                    // display clock "HH:MM:SS" (or "MM:SS")
  goal: string | null;
  label: string | null;
  focusS: number;                  // active focus seconds
  totalBreakS: number;             // total break seconds (closed + current)
  onBreak: boolean;
  currentBreakS: number;           // seconds in the current break (0 if not on break)
  breakCategory: BreakCategory;    // current/most-recent break category
  suggestedBreakS: number | null;  // proportional suggestion
  focusTargetS: number | null;
  breakBudgetS: number | null;
  zen: boolean;                    // hide footer + progress chrome (clock only)
  showControls: boolean;           // show the footer (overridden false by zen)
  displayStyle: DisplayStyle;      // "block" = solid glyphs · "simple" = minimal outline
  keybindings: {
    pause: string;
    reset: string;
    quit: string;
    break: string;
    category: string;
  };
}

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

/** Format whole seconds as MM:SS (no hours). Mirrors hud.ts formatMS. */
function fmtMS(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

/** Produce a blank line padded to innerW. */
function blankLine(innerW: number): string {
  return padTo("", innerW);
}

// ---------------------------------------------------------------------------
// Main render function
// ---------------------------------------------------------------------------

/**
 * Render the Session panel. Returns exactly `rect.height` rows each of
 * display-width `rect.width`.
 */
export function renderSession(
  state: SessionViewState,
  rect: Rect,
  theme: ThemeName,
  color: boolean,
): string[] {
  const innerW = Math.max(0, rect.width - 2);
  const innerH = Math.max(0, rect.height - 2);
  const themeColor = color ? THEME_FG[theme] : undefined;
  const RESET = "\x1b[0m";

  // ── IDLE ─────────────────────────────────────────────────────────────────
  if (!state.active) {
    const body = buildIdleBody(innerW, innerH);
    return panel({ title: "Session", width: rect.width, height: rect.height, body, color: themeColor });
  }

  // ── ACTIVE ───────────────────────────────────────────────────────────────
  const { goal, label, focusS, totalBreakS, focusTargetS, breakBudgetS,
          onBreak, currentBreakS, breakCategory, suggestedBreakS,
          zen, showControls, displayStyle, keybindings: kb, time } = state;

  // -- Top lines (goal/label) -----------------------------------------------
  const topLines: string[] = [];
  const goalText = goal ?? label;
  if (goalText) {
    const text = color ? paint(goalText, theme, true) : goalText;
    topLines.push(padTo(text, innerW));
  }

  // -- Bottom lines (progress + footer) -------------------------------------
  // In zen mode we suppress all chrome below the counter.
  const bottomLines: string[] = [];

  if (!zen) {
    // Focus progress line
    if (focusTargetS != null && focusTargetS > 0) {
      const ratio = Math.min(1, focusS / focusTargetS);
      const pct = Math.round(ratio * 100);
      const bar = barH(focusS, focusTargetS, 10);
      const won = focusS >= focusTargetS && (breakBudgetS == null || totalBreakS <= breakBudgetS);
      const prefix = won ? "✦ " : "";
      const progressLine = `${prefix}focus ${humanDuration(focusS)}/${humanDuration(focusTargetS)}  ▕${bar}▏ ${pct}%`;
      bottomLines.push(padTo(progressLine, innerW));
    }

    // Break summary line
    if (breakBudgetS != null || totalBreakS > 0) {
      const budgetStr = breakBudgetS != null ? humanDuration(breakBudgetS) : "—";
      let breakLine = `break ${humanDuration(totalBreakS)}/${budgetStr}`;
      if (totalBreakS > 0 && focusS > 0) {
        const r = breakRatio(focusS, totalBreakS);
        breakLine += ` · ratio 1:${r.toFixed(1)}`;
      }
      bottomLines.push(padTo(breakLine, innerW));
    }

    // On-break status line
    if (onBreak) {
      let onBreakLine = `☕ on break · ${breakCategory} · ${fmtMS(currentBreakS)}`;
      if (suggestedBreakS != null) {
        onBreakLine += `  (sug ${fmtMS(suggestedBreakS)})`;
      }
      bottomLines.push(padTo(onBreakLine, innerW));
    }

    // Footer / controls line
    if (showControls) {
      let footerLine: string;
      if (onBreak) {
        footerLine = `[1]rest [2]meal [3]exercise [4]walk [5]distraction [6]other  [${kb.break}] resume`;
      } else {
        footerLine = `[${kb.pause}] pause · [${kb.break}] break · [1-6] cat · [${kb.reset}] reset · [${kb.quit}] stop`;
      }
      bottomLines.push(padTo(footerLine, innerW));
    }
  }

  // -- Counter scaling: RESERVE-FIRST ---------------------------------------
  // Reserve space for top and bottom sections first, then scale the counter
  // into what remains. This is the critical guarantee that the counter does
  // NOT overshadow the metadata/footer.
  const topGap = topLines.length > 0 ? 1 : 0;       // blank row after top lines
  const bottomGap = bottomLines.length > 0 ? 1 : 0;  // blank row before bottom lines
  const reserved = topLines.length + topGap + bottomLines.length + bottomGap;
  const counterAreaRows = Math.max(BIG_ROWS, innerH - reserved);

  // Determine whether the big counter fits even at scale=1
  const fitsAtScaleOne = innerW >= bigWidth(time, 1) && (innerH - reserved) >= BIG_ROWS;

  let counterLines: string[];

  if (!fitsAtScaleOne) {
    // Panel is too small for the block font — fall back to a single centered
    // text line so tiny panels still display the clock.
    const raw = padTo(time, innerW, "center");
    const line = color ? `${THEME_FG[theme]}${raw}${RESET}` : raw;
    counterLines = [line];
  } else {
    const scale = computeSessionScale(innerW, counterAreaRows, time);
    // "simple" shares block's exact scale/dimensions but renders a minimal
    // hollow outline instead of solid glyphs. "block" is the default solid look.
    const rawLines =
      displayStyle === "simple"
        ? renderOutlineLines(time, scale)
        : renderBigLines(time, scale);
    counterLines = rawLines.map((line) => {
      const padded = padTo(line, innerW, "center");
      return color ? `${THEME_FG[theme]}${padded}${RESET}` : padded;
    });
  }

  // -- Assemble body with counter vertically centered in remaining space ----
  // Layout:  topLines | padTop blanks | counterLines | padBottom blanks | bottomLines
  const totalUsed = topLines.length + counterLines.length + bottomLines.length;
  const leftover = Math.max(0, innerH - totalUsed);
  const padTop = Math.floor(leftover / 2);
  const padBottom = leftover - padTop;

  const body: string[] = [];
  for (const line of topLines) body.push(padTo(line, innerW));
  for (let i = 0; i < padTop; i++) body.push(blankLine(innerW));
  for (const line of counterLines) body.push(padTo(line, innerW));
  for (let i = 0; i < padBottom; i++) body.push(blankLine(innerW));
  for (const line of bottomLines) body.push(padTo(line, innerW));

  // Safety clamp: if somehow we overshot innerH, drop trailing body lines.
  // (reserve math above should prevent this, but be defensive.)
  while (body.length > innerH) body.pop();

  // Pad out to exactly innerH if we undershot (e.g., very large panel with
  // few bottom lines and a capped counter).
  while (body.length < innerH) body.push(blankLine(innerW));

  return panel({ title: "Session", width: rect.width, height: rect.height, body, color: themeColor });
}

// ---------------------------------------------------------------------------
// Idle body builder
// ---------------------------------------------------------------------------

function buildIdleBody(innerW: number, innerH: number): string[] {
  const lines: string[] = [
    padTo("No active session", innerW, "center"),
    padTo("", innerW),
    padTo("Press [s] or Enter to start", innerW, "center"),
    padTo("or [/] for commands · start --goal --target --break-budget from your shell", innerW, "center"),
  ];

  const body: string[] = [];
  const padTop = Math.max(0, Math.floor((innerH - lines.length) / 2));

  for (let i = 0; i < padTop; i++) body.push(padTo("", innerW));
  for (const line of lines) body.push(line);
  while (body.length < innerH) body.push(padTo("", innerW));
  // Clamp
  while (body.length > innerH) body.pop();

  return body;
}

// Re-export displayWidth so tests can use it without a separate import path
export { displayWidth };
