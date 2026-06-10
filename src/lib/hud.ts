/**
 * Raw-ANSI HUD renderer. No Ink/React — keeps cold start instant and matches
 * the proven flowtime.sh behavior exactly: one centered HH:MM:SS line, no
 * chrome, and a clean skip (no partial draw) when the window is too small.
 */

export const ANSI = {
  hideCursor: "\x1b[?25l",
  showCursor: "\x1b[?25h",
  clear: "\x1b[2J\x1b[H",
  reset: "\x1b[0m",
  /** Move to a 1-based (row, col). */
  cursorTo: (row: number, col: number) => `\x1b[${row};${col}H`,
};

import { renderBigLines, bigWidth, computeScale, computeSessionScale, BIG_ROWS } from "./bigfont.js";
import type { BreakCategory } from "../schemas/session.js";
import { humanDuration } from "./format.js";
import { breakRatio } from "./flowtime.js";

export interface FrameInput {
  rows: number;
  cols: number;
  /** The HH:MM:SS string to center. */
  time: string;
  /** Optional pre-wrapped color sequence + reset; applied around the time. */
  colorOn?: string;
  colorOff?: string;
}

/**
 * Produce the full escape sequence for one frame. Returns "" when the window is
 * too small to hold the time string (mirrors flowtime.sh resize protection:
 * cols < len or rows < 1 → draw nothing). Centering matches the Bash math
 * (tput cup is 0-based; ANSI is 1-based, so we add 1 and clamp at 1).
 */
export function renderFrame(input: FrameInput): string {
  const { rows, cols, time } = input;
  if (!Number.isFinite(rows) || !Number.isFinite(cols)) return "";
  if (rows < 1 || cols < time.length) return "";

  const row = Math.floor(rows / 2) + 1;
  const col = Math.max(1, Math.floor((cols - time.length) / 2) + 1);

  const body = input.colorOn
    ? `${input.colorOn}${time}${input.colorOff ?? ANSI.reset}`
    : time;

  return `${ANSI.clear}${ANSI.cursorTo(row, col)}${body}`;
}

/**
 * Render one frame of the big 7-segment HUD. Returns "" when the window is too
 * short or too narrow for the block font — the caller then falls back to
 * `renderFrame` (compact), so `--big` degrades gracefully and never crashes.
 * The font scales up to ~75% of terminal width and ~50% of height (cap 3×) so
 * the clock stays prominent without dominating. Re-fires on every `resize` event.
 */
export function renderBigFrame(input: FrameInput): string {
  const { rows, cols, time } = input;
  if (!Number.isFinite(rows) || !Number.isFinite(cols)) return "";
  if (cols < bigWidth(time, 1) || rows < BIG_ROWS) return "";

  const scale = computeScale(cols, rows, time);
  const lines = renderBigLines(time, scale);
  const scaledHeight = BIG_ROWS * scale;
  const scaledWidth = lines[0]?.length ?? 0;

  const topRow = Math.max(1, Math.floor((rows - scaledHeight) / 2) + 1);
  const col = Math.max(1, Math.floor((cols - scaledWidth) / 2) + 1);
  const colorOn = input.colorOn ?? "";
  const colorOff = input.colorOn ? (input.colorOff ?? ANSI.reset) : "";

  let out = ANSI.clear;
  lines.forEach((line, i) => {
    out += ANSI.cursorTo(topRow + i, col) + colorOn + line + colorOff;
  });
  return out;
}

// ---------------------------------------------------------------------------
// Composable full-frame HUD (renderHud)
// ---------------------------------------------------------------------------

const DIM_ON = "\x1b[2m";
const DIM_OFF = "\x1b[22m";

/** Render a 10-cell progress bar for a ratio 0..1. */
function progressBar(ratio: number): string {
  const FILLED = "█";
  const EMPTY = "░";
  const cells = 10;
  const filled = Math.min(cells, Math.round(ratio * cells));
  return FILLED.repeat(filled) + EMPTY.repeat(cells - filled);
}

/** Format whole seconds as MM:SS (no hours). Used for break countdown. */
function formatMS(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

/**
 * Full state passed into `renderHud`. All fields are injected so rendering is
 * pure (testable without a real terminal).
 */
export interface HudState {
  rows: number;
  cols: number;
  /** The display time string, e.g. "01:23:45". */
  time: string;
  /** "simple" = plain text clock; "block" = 7-segment ASCII. */
  style: "simple" | "block";
  /** Theme color on/off sequences (optional; omit for no color). */
  colorOn?: string;
  colorOff?: string;
  /** Zen mode: clock only, no footer or progress block. */
  zen: boolean;
  /** Whether to show the controls footer (overridden false by zen). */
  showControls: boolean;
  /** Currently on a break? */
  onBreak: boolean;
  /** Active focus seconds elapsed. */
  focusS: number;
  /** Total break seconds (closed + current). */
  totalBreakS: number;
  /** Seconds elapsed in the current break (0 if not on break). */
  currentBreakS?: number;
  /** Category of the current (or most recent) break. */
  breakCategory?: BreakCategory;
  /** Suggested break length in seconds (shown when break starts). */
  suggestedBreakS?: number | null;
  /** Session goal label (shown in progress). */
  goal?: string | null;
  /** Focus target in seconds. */
  focusTargetS?: number | null;
  /** Break budget in seconds. */
  breakBudgetS?: number | null;
  /** Keybinding characters for footer. */
  keybindings: {
    pause: string;
    reset: string;
    quit: string;
    break: string;
    category: string;
  };
}

/**
 * Render a complete HUD frame as a string of ANSI escape sequences.
 *
 * Layout (from top):
 *   [optional progress block — 1–2 lines above the clock]
 *   [clock — vertically centered anchor]
 *   [optional controls footer — below the clock]
 *
 * Falls back to clock-only when the terminal is too small for extras, and
 * returns "" when even the clock doesn't fit (never partial draw).
 */
export function renderHud(state: HudState): string {
  const { rows, cols, time, style, zen } = state;
  if (!Number.isFinite(rows) || !Number.isFinite(cols)) return "";

  // ── Build optional progress block and footer strings ─────────────────────
  // These must be computed first so the block-style clock can reserve their
  // vertical space before choosing its scale.
  const showExtras = !zen;
  let progressLines: string[] = [];
  let footerLines: string[] = [];

  if (showExtras) {
    progressLines = buildProgressLines(state);
    footerLines = buildFooterLines(state);
  }

  // ── Compute clock block dimensions ────────────────────────────────────────
  let clockLines: string[];
  let clockWidth: number;
  let clockHeight: number;

  if (style === "block") {
    if (cols < bigWidth(time, 1) || rows < BIG_ROWS) {
      // Block doesn't fit — fall back to simple
      if (rows < 1 || cols < time.length) return "";
      clockLines = [time];
      clockWidth = time.length;
      clockHeight = 1;
    } else if (zen) {
      // Zen: no extras, fill the full area with the clock
      const scale = computeSessionScale(cols, rows, time);
      clockLines = renderBigLines(time, scale);
      clockHeight = BIG_ROWS * scale;
      clockWidth = clockLines[0]?.length ?? 0;
    } else {
      // Reserve rows for progress and footer before choosing scale so the
      // counter never crowds the metadata/footer out of the layout.
      const progressGapR = progressLines.length > 0 ? 1 : 0;
      const footerGapR = footerLines.length > 0 ? 1 : 0;
      const reserved =
        progressLines.length + progressGapR + footerLines.length + footerGapR;
      const availableRows = Math.max(BIG_ROWS, rows - reserved);
      const scale = computeSessionScale(cols, availableRows, time);
      clockLines = renderBigLines(time, scale);
      clockHeight = BIG_ROWS * scale;
      clockWidth = clockLines[0]?.length ?? 0;
    }
  } else {
    if (rows < 1 || cols < time.length) return "";
    clockLines = [time];
    clockWidth = time.length;
    clockHeight = 1;
  }

  // ── Total height needed ───────────────────────────────────────────────────
  const progressGap = progressLines.length > 0 ? 1 : 0; // blank row between progress and clock
  const footerGap = footerLines.length > 0 ? 1 : 0;
  const totalH =
    progressLines.length +
    progressGap +
    clockHeight +
    footerGap +
    footerLines.length;

  // If it doesn't fit, try clock-only
  if (totalH > rows) {
    // Try just the clock
    const clockOnlyH = clockHeight;
    if (clockOnlyH > rows) return "";
    // Render clock only
    return renderClockOnly(state, clockLines, clockWidth, clockHeight);
  }

  // ── Vertical layout ───────────────────────────────────────────────────────
  // Center the whole block in the terminal
  const blockTop = Math.max(1, Math.floor((rows - totalH) / 2) + 1);

  let out = ANSI.clear;
  let currentRow = blockTop;

  // Progress block
  if (progressLines.length > 0) {
    for (const line of progressLines) {
      const col = Math.max(1, Math.floor((cols - stripAnsi(line).length) / 2) + 1);
      out += ANSI.cursorTo(currentRow, col) + line;
      currentRow++;
    }
    currentRow += progressGap; // blank row
  }

  // Clock
  const colorOn = state.colorOn ?? "";
  const colorOff = state.colorOn ? (state.colorOff ?? ANSI.reset) : "";
  const clockCol = Math.max(1, Math.floor((cols - clockWidth) / 2) + 1);
  for (let i = 0; i < clockLines.length; i++) {
    out += ANSI.cursorTo(currentRow + i, clockCol) + colorOn + (clockLines[i] ?? "") + colorOff;
  }
  currentRow += clockHeight;

  // Footer
  if (footerLines.length > 0) {
    currentRow += footerGap; // blank row
    for (const line of footerLines) {
      const col = Math.max(1, Math.floor((cols - stripAnsi(line).length) / 2) + 1);
      out += ANSI.cursorTo(currentRow, col) + line;
      currentRow++;
    }
  }

  return out;
}

/** Strip ANSI escape sequences to get the display width of a string. */
function stripAnsi(s: string): string {
  // eslint-disable-next-line no-control-regex
  return s.replace(/\x1b\[[0-9;]*m/g, "");
}

function renderClockOnly(
  state: HudState,
  clockLines: string[],
  clockWidth: number,
  clockHeight: number,
): string {
  const { rows, cols } = state;
  const colorOn = state.colorOn ?? "";
  const colorOff = state.colorOn ? (state.colorOff ?? ANSI.reset) : "";
  const topRow = Math.max(1, Math.floor((rows - clockHeight) / 2) + 1);
  const clockCol = Math.max(1, Math.floor((cols - clockWidth) / 2) + 1);
  let out = ANSI.clear;
  for (let i = 0; i < clockLines.length; i++) {
    out += ANSI.cursorTo(topRow + i, clockCol) + colorOn + (clockLines[i] ?? "") + colorOff;
  }
  return out;
}

/**
 * Build the 1–2 progress lines shown above the clock.
 * Returns [] when there's nothing meaningful to show.
 */
function buildProgressLines(state: HudState): string[] {
  const { focusS, totalBreakS, focusTargetS, breakBudgetS, goal, onBreak } = state;
  const lines: string[] = [];

  const hasProgress =
    focusTargetS != null || breakBudgetS != null || onBreak || totalBreakS > 0 || goal != null;

  if (!hasProgress) return lines;

  // Focus line
  if (focusTargetS != null && focusTargetS > 0) {
    const ratio = Math.min(1, focusS / focusTargetS);
    const pct = Math.round(ratio * 100);
    const bar = progressBar(ratio);
    const label = goal ? goal : "focus";
    const targetStr = humanDuration(focusTargetS);
    const focusStr = humanDuration(focusS);
    const won =
      focusS >= focusTargetS && (breakBudgetS == null || totalBreakS <= breakBudgetS);
    const prefix = won ? "✦ " : "";
    const focusLine = `${prefix}${label} · ${focusStr}/${targetStr} ${bar} ${pct}%`;
    lines.push(DIM_ON + focusLine + DIM_OFF);
  } else if (goal != null) {
    lines.push(DIM_ON + goal + DIM_OFF);
  }

  // Break line
  if (breakBudgetS != null || onBreak || totalBreakS > 0) {
    const budgetStr = breakBudgetS != null ? humanDuration(breakBudgetS) : "—";
    const breakStr = humanDuration(totalBreakS);
    let breakLine = `break ${breakStr}/${budgetStr}`;
    if (totalBreakS > 0 && focusS > 0) {
      const r = breakRatio(focusS, totalBreakS);
      breakLine += ` · ratio 1:${r.toFixed(1)}`;
    }
    lines.push(DIM_ON + breakLine + DIM_OFF);
  }

  return lines;
}

const BREAK_CATEGORY_LABELS: Record<BreakCategory, string> = {
  rest: "rest",
  meal: "meal",
  exercise: "exercise",
  walk: "walk",
  distraction: "distraction",
  other: "other",
};

/**
 * Build the controls footer lines.
 * Returns [] when showControls is false or zen is active (caller checks).
 */
function buildFooterLines(state: HudState): string[] {
  if (!state.showControls) return [];

  const kb = state.keybindings;

  if (state.onBreak) {
    const cat = state.breakCategory ?? "rest";
    const catLabel = BREAK_CATEGORY_LABELS[cat];
    const elapsed = formatMS(state.currentBreakS ?? 0);
    const suggested =
      state.suggestedBreakS != null ? ` suggested ${formatMS(state.suggestedBreakS)}` : "";
    const line1 = `${DIM_ON}☕ BREAK · ${catLabel} · ${elapsed}${suggested}${DIM_OFF}`;
    const line2 =
      `${DIM_ON}[1]rest [2]meal [3]exercise [4]walk [5]distraction [6]other` +
      `   [${kb.break}] resume${DIM_OFF}`;
    return [line1, line2];
  }

  const line =
    `${DIM_ON}[${kb.pause}] pause  [${kb.break}] break  [${kb.reset}] reset  [${kb.quit}] stop${DIM_OFF}`;
  return [line];
}
