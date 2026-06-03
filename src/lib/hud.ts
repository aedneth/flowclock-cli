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

import { renderBigLines, bigWidth, BIG_ROWS, BIG_MIN_COLS } from "./bigfont.js";

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
 */
export function renderBigFrame(input: FrameInput): string {
  const { rows, cols, time } = input;
  if (!Number.isFinite(rows) || !Number.isFinite(cols)) return "";

  const width = bigWidth(time);
  // Fall back on narrow terminals (per spec) or when the block can't fit.
  if (cols < BIG_MIN_COLS || cols < width || rows < BIG_ROWS) return "";

  const lines = renderBigLines(time);
  const topRow = Math.max(1, Math.floor((rows - BIG_ROWS) / 2) + 1);
  const col = Math.max(1, Math.floor((cols - width) / 2) + 1);
  const colorOn = input.colorOn ?? "";
  const colorOff = input.colorOn ? (input.colorOff ?? ANSI.reset) : "";

  let out = ANSI.clear;
  lines.forEach((line, i) => {
    out += ANSI.cursorTo(topRow + i, col) + colorOn + line + colorOff;
  });
  return out;
}
