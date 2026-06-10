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
