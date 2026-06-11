/**
 * Minimal 5-row block font for the `--big` HUD. Covers the only glyphs a clock
 * ever needs: digits 0-9 and the colon. Each glyph is 5 rows tall; digits are 4
 * columns wide and the colon is 1, so a full "HH:MM:SS" is 33 columns at scale 1.
 * The font scales up to fill the available terminal space via `computeScale`.
 */

import type { DisplayStyle } from "../schemas/config.js";

export const BIG_ROWS = 5;
/** Minimum cols to render HH:MM:SS at scale 1 (exact base width). */
export const BIG_MIN_COLS = 33;

const GLYPHS: Record<string, string[]> = {
  "0": ["████", "█  █", "█  █", "█  █", "████"],
  "1": ["  █ ", " ██ ", "  █ ", "  █ ", " ███"],
  "2": ["████", "   █", "████", "█   ", "████"],
  "3": ["████", "   █", " ███", "   █", "████"],
  "4": ["█  █", "█  █", "████", "   █", "   █"],
  "5": ["████", "█   ", "████", "   █", "████"],
  "6": ["████", "█   ", "████", "█  █", "████"],
  "7": ["████", "   █", "  █ ", " █  ", " █  "],
  "8": ["████", "█  █", "████", "█  █", "████"],
  "9": ["████", "█  █", "████", "   █", "████"],
  ":": [" ", "█", " ", "█", " "],
};

const GAP = " "; // one blank column between glyphs

/**
 * Largest integer scale that fits `time` in the given terminal dimensions.
 * scale=1 is the original size; scale=2 doubles both width and height; etc.
 * Targets ~75% of terminal width and ~50% of height so the clock stays
 * prominent but never fills the screen — capped at 3 beyond which the `█`
 * blocks lose their digital-clock shape and become solid rectangles.
 */
export function computeScale(cols: number, rows: number, time: string): number {
  const baseW = bigWidth(time, 1);
  if (baseW === 0) return 1;
  const ws = Math.floor((cols * 0.75) / baseW);
  const hs = Math.floor((rows * 0.50) / BIG_ROWS);
  return Math.max(1, Math.min(ws, hs, 3));
}

/**
 * Render a clock string (e.g. "01:23:45") as an array of `BIG_ROWS * scale`
 * text rows. scale=1 (default) reproduces the original output exactly.
 * Unknown characters render as a blank cell so the function never throws.
 */
export function renderBigLines(time: string, scale = 1): string[] {
  const totalRows = BIG_ROWS * scale;
  const rows = Array.from({ length: totalRows }, () => "");
  const chars = [...time];
  chars.forEach((ch, idx) => {
    const glyph = GLYPHS[ch] ?? [" ", " ", " ", " ", " "];
    const sep = idx < chars.length - 1 ? GAP.repeat(scale) : "";
    for (let r = 0; r < BIG_ROWS; r++) {
      const scaledRow = [...(glyph[r] ?? "")].map((c) => c.repeat(scale)).join("");
      for (let s = 0; s < scale; s++) {
        rows[r * scale + s] = (rows[r * scale + s] ?? "") + scaledRow + sep;
      }
    }
  });
  return rows;
}

/** Width in columns of the rendered block at the given scale (default 1). */
export function bigWidth(time: string, scale = 1): number {
  return renderBigLines(time, scale)[0]?.length ?? 0;
}

/**
 * Seven-segment membership per glyph, indexed [a, b, c, d, e, f, g]:
 *
 *      a            a = top          d = bottom
 *    f   b          b = upper-right  e = lower-left
 *      g            c = lower-right  f = upper-left
 *    e   c          g = middle
 *      d
 */
const SEVEN_SEG: Record<string, string> = {
  //   abcdefg
  "0": "1111110",
  "1": "0110000",
  "2": "1101101",
  "3": "1111001",
  "4": "0110011",
  "5": "1011011",
  "6": "1011111",
  "7": "1110000",
  "8": "1111111",
  "9": "1111011",
};

/**
 * Pick the box-drawing character for a junction, given which of the four
 * directions have a stroke emanating from this cell. `heavy` selects the weight
 * (┃━┏┓ vs │─┌┐). Lone stubs continue the stroke (┃/━ or │/─) rather than using
 * half-caps, so digit edges read as clean, continuous lines.
 */
function boxChar(up: boolean, down: boolean, left: boolean, right: boolean, heavy: boolean): string {
  const v = heavy ? "┃" : "│";
  const h = heavy ? "━" : "─";
  const key = (up ? 8 : 0) | (down ? 4 : 0) | (left ? 2 : 0) | (right ? 1 : 0);
  switch (key) {
    case 0b1100: return v;                  // up + down
    case 0b0011: return h;                  // left + right
    case 0b0101: return heavy ? "┏" : "┌";  // down + right
    case 0b0110: return heavy ? "┓" : "┐";  // down + left
    case 0b1001: return heavy ? "┗" : "└";  // up + right
    case 0b1010: return heavy ? "┛" : "┘";  // up + left
    case 0b1101: return heavy ? "┣" : "├";  // up + down + right
    case 0b1110: return heavy ? "┫" : "┤";  // up + down + left
    case 0b0111: return heavy ? "┳" : "┬";  // down + left + right
    case 0b1011: return heavy ? "┻" : "┴";  // up + left + right
    case 0b1111: return heavy ? "╋" : "┼";  // all four
    case 0b1000:                            // lone up   → continue vertical
    case 0b0100: return v;                  // lone down
    case 0b0010:                            // lone left → continue horizontal
    case 0b0001: return h;                  // lone right
    default: return " ";
  }
}

/** Render one seven-segment digit as a scale-sized grid of box-drawing rows. */
function digitGrid(seg: string, scale: number, heavy: boolean): string[] {
  const W = 4 * scale;
  const H = BIG_ROWS * scale;
  const mid = Math.floor(H / 2);
  const hbar = heavy ? "━" : "─";
  const vbar = heavy ? "┃" : "│";
  const a = seg[0] === "1", b = seg[1] === "1", c = seg[2] === "1", d = seg[3] === "1";
  const e = seg[4] === "1", f = seg[5] === "1", g = seg[6] === "1";

  const grid: string[][] = Array.from({ length: H }, () =>
    Array.from({ length: W }, () => " "),
  );

  // Horizontal strokes (interior columns only; corners handled below).
  for (let x = 1; x < W - 1; x++) {
    if (a) grid[0]![x] = hbar;
    if (g) grid[mid]![x] = hbar;
    if (d) grid[H - 1]![x] = hbar;
  }
  // Vertical strokes (interior rows only).
  for (let y = 1; y < mid; y++) {
    if (f) grid[y]![0] = vbar;
    if (b) grid[y]![W - 1] = vbar;
  }
  for (let y = mid + 1; y < H - 1; y++) {
    if (e) grid[y]![0] = vbar;
    if (c) grid[y]![W - 1] = vbar;
  }
  // Six corner / junction cells.
  grid[0]![0]       = boxChar(false, f, false, a, heavy);
  grid[0]![W - 1]   = boxChar(false, b, a, false, heavy);
  grid[mid]![0]     = boxChar(f, e, false, g, heavy);
  grid[mid]![W - 1] = boxChar(b, c, g, false, heavy);
  grid[H - 1]![0]   = boxChar(e, false, false, d, heavy);
  grid[H - 1]![W - 1] = boxChar(c, false, d, false, heavy);

  return grid.map((row) => row.join(""));
}

/** Render a colon (two `dot` marks) at `scale`, matching the block colon's width. */
function colonGrid(scale: number, dot: string): string[] {
  const W = scale; // 1 * scale, identical to the block colon's width
  const H = BIG_ROWS * scale;
  const cx = Math.floor((W - 1) / 2);
  const upper = Math.floor(H * 0.3);
  const lower = Math.floor(H * 0.7);
  return Array.from({ length: H }, (_, r) =>
    Array.from({ length: W }, (_, x) => (x === cx && (r === upper || r === lower) ? dot : " ")).join(""),
  );
}

/**
 * Shared seven-segment renderer for the line-art styles. Each digit is a clean
 * seven-segment glyph drawn in box-drawing characters; `heavy` selects the
 * stroke weight (┏━┓┃ vs ┌─┐│) and `dot` is the colon mark.
 *
 * It shares the EXACT width/height geometry of the solid `renderBigLines`
 * (digit = 4·scale wide, colon = 1·scale wide, gap = scale, height =
 * BIG_ROWS·scale), so the reserve-first scaling maths and small-panel fallback
 * thresholds are byte-for-byte identical to the block style. Crucially, it
 * scales cleanly at EVERY integer scale — each stroke stays exactly one cell
 * thick — unlike a silhouette traced from a solid block, which hollows every
 * stroke into a doubled "tube" at scale ≥ 2.
 */
function renderSevenSeg(time: string, scale: number, heavy: boolean, dot: string): string[] {
  const H = BIG_ROWS * scale;
  const rows: string[] = Array.from({ length: H }, () => "");
  const chars = [...time];
  const gap = " ".repeat(scale);

  chars.forEach((chr, idx) => {
    let glyph: string[];
    if (chr === ":") {
      glyph = colonGrid(scale, dot);
    } else if (SEVEN_SEG[chr]) {
      glyph = digitGrid(SEVEN_SEG[chr]!, scale, heavy);
    } else {
      // Unknown char → blank column matching the block font's blank width.
      glyph = Array.from({ length: H }, () => " ".repeat(scale));
    }
    const sep = idx < chars.length - 1 ? gap : "";
    for (let r = 0; r < H; r++) rows[r] += (glyph[r] ?? "") + sep;
  });

  return rows;
}

/**
 * Render a clock string as a MINIMAL HEAVY-line clock — the "simple" display
 * style. Each digit is a clean seven-segment glyph in heavy box-drawing
 * characters (┏━┓ ┃ ┣━┫ ┗━┛) instead of solid blocks. Distinct from `block` at
 * every scale — including scale 1 — so toggling styles is always visible.
 */
export function renderSimpleLines(time: string, scale = 1): string[] {
  return renderSevenSeg(time, scale, true, "●");
}

/**
 * Render a clock string as a LIGHT-line clock — the "outline" display style.
 * Same clean seven-segment skeleton as `simple`, but drawn in LIGHT box-drawing
 * characters (┌─┐ │ ├─┤ └─┘) with an airy "○" colon, so it reads as a distinct,
 * hollow/airy style next to the heavy `simple` and the solid `block` at every
 * scale.
 *
 * Earlier versions traced the silhouette of the solid block font. That looked
 * fine at scale 1 but BROKE at scale ≥ 2: each one-cell-thick block stroke,
 * once enlarged, was outlined into a doubled hollow "tube" (spurious inner
 * lines) — the garbled rendering seen in tiled/large windows. Drawing the
 * seven-segment skeleton directly keeps every stroke one cell thick at any
 * scale, so the digits stay crisp.
 */
export function renderOutlineLines(time: string, scale = 1): string[] {
  return renderSevenSeg(time, scale, false, "○");
}

/**
 * Largest integer scale (>=1) that fits `time` in an area the CALLER has
 * already reserved (i.e. metadata/footer space is subtracted before calling).
 * Targets ~92% of the area so the counter is prominent but keeps a little air.
 * Caller must still verify the block fits at scale 1 for very small areas
 * (areaCols >= bigWidth(time,1)); this returns >=1 regardless.
 */
export function computeSessionScale(
  areaCols: number,
  areaRows: number,
  time: string,
  opts: { maxScale?: number; style?: DisplayStyle } = {},
): number {
  const style = opts.style ?? "block";
  const baseW = styleWidth(style, time, 1);
  if (baseW === 0) return 1;
  const ws = Math.floor((areaCols * 0.92) / baseW);
  const hs = Math.floor((areaRows * 0.95) / styleBaseRows(style));
  const cap = opts.maxScale ?? 4;
  return Math.max(1, Math.min(ws, hs, cap));
}

// ---------------------------------------------------------------------------
// Tall solid "classic" / "bold" fonts — terminal-style numerals
// ---------------------------------------------------------------------------

/**
 * Per-style glyph geometry. `block`/`simple`/`outline` share the original
 * 5-row, 4-wide-digit footprint; `classic`/`bold` are taller (9 rows) solid
 * letterforms. Threading these metrics through the scaling maths keeps the
 * reserve-first layout exact for every style.
 */
interface StyleMetrics {
  rows: number;
  digitW: number;
  colonW: number;
}

const STYLE_METRICS: Record<DisplayStyle, StyleMetrics> = {
  block:   { rows: BIG_ROWS, digitW: 4, colonW: 1 },
  simple:  { rows: BIG_ROWS, digitW: 4, colonW: 1 },
  outline: { rows: BIG_ROWS, digitW: 4, colonW: 1 },
  classic: { rows: 9, digitW: 5, colonW: 1 },
  bold:    { rows: 9, digitW: 6, colonW: 2 },
};

/** Number of text rows the style occupies at scale 1. */
export function styleBaseRows(style: DisplayStyle): number {
  return STYLE_METRICS[style].rows;
}

/** Exact rendered width (cols) of `time` in `style` at the given scale. */
export function styleWidth(style: DisplayStyle, time: string, scale = 1): number {
  const m = STYLE_METRICS[style];
  const chars = [...time];
  let w = 0;
  chars.forEach((ch, i) => {
    w += ch === ":" ? m.colonW : m.digitW;
    if (i < chars.length - 1) w += 1; // one-column gap between glyphs
  });
  return w * scale;
}

// 5-wide × 9-tall LIGHT letterforms (the `classic` style).
const CLASSIC_GLYPHS: Record<string, string[]> = {
  "0": [" ███ ", "█   █", "█   █", "█   █", "█   █", "█   █", "█   █", "█   █", " ███ "],
  "1": ["  █  ", " ██  ", "  █  ", "  █  ", "  █  ", "  █  ", "  █  ", "  █  ", " ███ "],
  "2": [" ███ ", "█   █", "    █", "    █", "   █ ", "  █  ", " █   ", "█    ", "█████"],
  "3": [" ███ ", "█   █", "    █", "  ██ ", "    █", "    █", "    █", "█   █", " ███ "],
  "4": ["   █ ", "  ██ ", " █ █ ", "█  █ ", "█████", "   █ ", "   █ ", "   █ ", "   █ "],
  "5": ["█████", "█    ", "█    ", "████ ", "    █", "    █", "    █", "█   █", " ███ "],
  "6": [" ███ ", "█   █", "█    ", "█    ", "████ ", "█   █", "█   █", "█   █", " ███ "],
  "7": ["█████", "    █", "   █ ", "   █ ", "  █  ", "  █  ", " █   ", " █   ", " █   "],
  "8": [" ███ ", "█   █", "█   █", "█   █", " ███ ", "█   █", "█   █", "█   █", " ███ "],
  "9": [" ███ ", "█   █", "█   █", "█   █", " ████", "    █", "    █", "█   █", " ███ "],
  ":": [" ", " ", "█", " ", " ", " ", "█", " ", " "],
};

// 6-wide × 9-tall HEAVY letterforms (the `bold` style).
const BOLD_GLYPHS: Record<string, string[]> = {
  "0": [" ████ ", "██  ██", "██  ██", "██  ██", "██  ██", "██  ██", "██  ██", "██  ██", " ████ "],
  "1": ["  ██  ", " ███  ", "  ██  ", "  ██  ", "  ██  ", "  ██  ", "  ██  ", "  ██  ", " ████ "],
  "2": [" ████ ", "██  ██", "    ██", "   ██ ", "  ██  ", " ██   ", "██    ", "██    ", "██████"],
  "3": [" ████ ", "██  ██", "    ██", "  ███ ", "    ██", "    ██", "    ██", "██  ██", " ████ "],
  "4": ["   ██ ", "  ███ ", " ████ ", "██ ██ ", "██████", "   ██ ", "   ██ ", "   ██ ", "   ██ "],
  "5": ["██████", "██    ", "██    ", "█████ ", "    ██", "    ██", "    ██", "██  ██", " ████ "],
  "6": [" ████ ", "██  ██", "██    ", "██    ", "█████ ", "██  ██", "██  ██", "██  ██", " ████ "],
  "7": ["██████", "    ██", "   ██ ", "   ██ ", "  ██  ", "  ██  ", " ██   ", " ██   ", " ██   "],
  "8": [" ████ ", "██  ██", "██  ██", "██  ██", " ████ ", "██  ██", "██  ██", "██  ██", " ████ "],
  "9": [" ████ ", "██  ██", "██  ██", "██  ██", " █████", "    ██", "    ██", "██  ██", " ████ "],
  ":": ["  ", "  ", "██", "██", "  ", "██", "██", "  ", "  "],
};

/**
 * Render a 9-row solid-letterform font (classic/bold) by integer cell-repeat —
 * crisp at every scale, no half-block artefacts. Width parity with
 * `styleWidth` is guaranteed by the glyph tables matching STYLE_METRICS.
 */
function renderTallSolid(
  time: string,
  scale: number,
  glyphs: Record<string, string[]>,
  rows: number,
  digitW: number,
): string[] {
  const H = rows * scale;
  const out = Array.from({ length: H }, () => "");
  const chars = [...time];
  const blank = Array.from({ length: rows }, () => " ".repeat(digitW));
  chars.forEach((ch, idx) => {
    const g = glyphs[ch] ?? blank;
    const sep = idx < chars.length - 1 ? " ".repeat(scale) : "";
    for (let r = 0; r < rows; r++) {
      const line = [...(g[r] ?? "")].map((c) => c.repeat(scale)).join("");
      for (let s = 0; s < scale; s++) out[r * scale + s] += line + sep;
    }
  });
  return out;
}

/** Render the `classic` style — tall LIGHT solid terminal numerals. */
export function renderClassicLines(time: string, scale = 1): string[] {
  return renderTallSolid(time, scale, CLASSIC_GLYPHS, STYLE_METRICS.classic.rows, STYLE_METRICS.classic.digitW);
}

/** Render the `bold` style — tall HEAVY solid terminal numerals. */
export function renderBoldLines(time: string, scale = 1): string[] {
  return renderTallSolid(time, scale, BOLD_GLYPHS, STYLE_METRICS.bold.rows, STYLE_METRICS.bold.digitW);
}

/** Render `time` in the requested display style at the given scale. */
export function renderCounter(style: DisplayStyle, time: string, scale = 1): string[] {
  switch (style) {
    case "simple":  return renderSimpleLines(time, scale);
    case "outline": return renderOutlineLines(time, scale);
    case "classic": return renderClassicLines(time, scale);
    case "bold":    return renderBoldLines(time, scale);
    default:        return renderBigLines(time, scale);
  }
}
