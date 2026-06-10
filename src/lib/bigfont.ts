/**
 * Minimal 5-row block font for the `--big` HUD. Covers the only glyphs a clock
 * ever needs: digits 0-9 and the colon. Each glyph is 5 rows tall; digits are 4
 * columns wide and the colon is 1, so a full "HH:MM:SS" is 33 columns at scale 1.
 * The font scales up to fill the available terminal space via `computeScale`.
 */

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
 * Pick the heavy box-drawing character for a junction, given which of the four
 * directions have a stroke emanating from this cell. Lone stubs continue the
 * stroke (┃/━) rather than using half-caps, so digit edges read as clean,
 * continuous lines.
 */
function boxChar(up: boolean, down: boolean, left: boolean, right: boolean): string {
  const key = (up ? 8 : 0) | (down ? 4 : 0) | (left ? 2 : 0) | (right ? 1 : 0);
  switch (key) {
    case 0b1100: return "┃"; // up + down
    case 0b0011: return "━"; // left + right
    case 0b0101: return "┏"; // down + right
    case 0b0110: return "┓"; // down + left
    case 0b1001: return "┗"; // up + right
    case 0b1010: return "┛"; // up + left
    case 0b1101: return "┣"; // up + down + right
    case 0b1110: return "┫"; // up + down + left
    case 0b0111: return "┳"; // down + left + right
    case 0b1011: return "┻"; // up + left + right
    case 0b1111: return "╋"; // all four
    case 0b1000: // lone up   → continue vertical
    case 0b0100: return "┃";  // lone down
    case 0b0010: // lone left → continue horizontal
    case 0b0001: return "━";  // lone right
    default: return " ";
  }
}

/** Render one seven-segment digit as a scale-sized grid of box-drawing rows. */
function digitGrid(seg: string, scale: number): string[] {
  const W = 4 * scale;
  const H = BIG_ROWS * scale;
  const mid = Math.floor(H / 2);
  const a = seg[0] === "1", b = seg[1] === "1", c = seg[2] === "1", d = seg[3] === "1";
  const e = seg[4] === "1", f = seg[5] === "1", g = seg[6] === "1";

  const grid: string[][] = Array.from({ length: H }, () =>
    Array.from({ length: W }, () => " "),
  );

  // Horizontal strokes (interior columns only; corners handled below).
  for (let x = 1; x < W - 1; x++) {
    if (a) grid[0]![x] = "━";
    if (g) grid[mid]![x] = "━";
    if (d) grid[H - 1]![x] = "━";
  }
  // Vertical strokes (interior rows only).
  for (let y = 1; y < mid; y++) {
    if (f) grid[y]![0] = "┃";
    if (b) grid[y]![W - 1] = "┃";
  }
  for (let y = mid + 1; y < H - 1; y++) {
    if (e) grid[y]![0] = "┃";
    if (c) grid[y]![W - 1] = "┃";
  }
  // Six corner / junction cells.
  grid[0]![0]       = boxChar(false, f, false, a);
  grid[0]![W - 1]   = boxChar(false, b, a, false);
  grid[mid]![0]     = boxChar(f, e, false, g);
  grid[mid]![W - 1] = boxChar(b, c, g, false);
  grid[H - 1]![0]   = boxChar(e, false, false, d);
  grid[H - 1]![W - 1] = boxChar(c, false, d, false);

  return grid.map((row) => row.join(""));
}

/** Render a colon (two dots) at `scale`, matching the block colon's width. */
function colonGrid(scale: number): string[] {
  const W = scale; // 1 * scale, identical to the block colon's width
  const H = BIG_ROWS * scale;
  const cx = Math.floor((W - 1) / 2);
  const upper = Math.floor(H * 0.3);
  const lower = Math.floor(H * 0.7);
  return Array.from({ length: H }, (_, r) =>
    Array.from({ length: W }, (_, x) => (x === cx && (r === upper || r === lower) ? "●" : " ")).join(""),
  );
}

/**
 * Render a clock string as a MINIMAL heavy-line clock — the "simple" display
 * style. Each digit is drawn as a clean seven-segment glyph in heavy
 * box-drawing characters (┏━┓ ┃ ┣━┫ ┗━┛) instead of solid blocks.
 *
 * It shares the EXACT width/height geometry of the solid `renderBigLines`
 * (digit = 4·scale wide, colon = 1·scale wide, gap = scale, height =
 * BIG_ROWS·scale), so the reserve-first scaling maths and small-panel fallback
 * thresholds are byte-for-byte identical to the block style. Unlike the old
 * edge-traced outline, it reads as distinctly different from `block` at every
 * scale — including scale 1 — so toggling styles is always visible.
 */
export function renderSimpleLines(time: string, scale = 1): string[] {
  const H = BIG_ROWS * scale;
  const rows: string[] = Array.from({ length: H }, () => "");
  const chars = [...time];
  const gap = " ".repeat(scale);

  chars.forEach((chr, idx) => {
    let glyph: string[];
    if (chr === ":") {
      glyph = colonGrid(scale);
    } else if (SEVEN_SEG[chr]) {
      glyph = digitGrid(SEVEN_SEG[chr]!, scale);
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
 * Render a clock string as a HOLLOW / OUTLINE block — the "outline" display
 * style. It shares the exact geometry, scaling and dimensions of the solid
 * `renderBigLines` (so the reserve-first layout maths are identical), but only
 * the EDGE cells of each glyph are drawn: interiors are hollowed out. The
 * result is an airy, edge-traced clock — distinct from both the solid `block`
 * and the line-art `simple` styles.
 *
 * Implementation: render the solid block at the same scale, then keep a filled
 * cell only when at least one of its 4-neighbours is empty (or off the grid).
 * Because it's derived from the solid render, it scales cleanly at any size and
 * stays perfectly aligned with the block style. Note: at scale 1 the glyphs are
 * too thin to have interiors, so the outline coincides with the solid block.
 *
 * @param fill character used for the outline strokes (default "█").
 */
export function renderOutlineLines(
  time: string,
  scale = 1,
  fill = "█",
): string[] {
  const solid = renderBigLines(time, scale);
  const grid = solid.map((line) => [...line]);
  const filled = (r: number, c: number): boolean =>
    r >= 0 && r < grid.length && c >= 0 && c < (grid[r]?.length ?? 0) && grid[r]![c] === "█";

  return grid.map((cells, r) =>
    cells
      .map((ch, c) => {
        if (ch !== "█") return " ";
        // Interior cell: all four neighbours filled → hollow it out.
        const isEdge =
          !filled(r - 1, c) || !filled(r + 1, c) || !filled(r, c - 1) || !filled(r, c + 1);
        return isEdge ? fill : " ";
      })
      .join(""),
  );
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
  opts: { maxScale?: number } = {},
): number {
  const baseW = bigWidth(time, 1);
  if (baseW === 0) return 1;
  const ws = Math.floor((areaCols * 0.92) / baseW);
  const hs = Math.floor((areaRows * 0.95) / BIG_ROWS);
  const cap = opts.maxScale ?? 4;
  return Math.max(1, Math.min(ws, hs, cap));
}
