/**
 * Minimal 5-row block font for the `--big` HUD. Covers the only glyphs a clock
 * ever needs: digits 0-9 and the colon. Each glyph is 5 rows tall; digits are 4
 * columns wide and the colon is 1, so a full "HH:MM:SS" is 43 columns — the
 * caller falls back to the compact HUD below `BIG_MIN_COLS`.
 */

export const BIG_ROWS = 5;
/** Terminal must be at least this wide or we fall back to the compact HUD. */
export const BIG_MIN_COLS = 60;

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
 * Render a clock string (e.g. "01:23:45") as an array of `BIG_ROWS` text rows.
 * Unknown characters render as a blank 1-column cell, so the function never
 * throws on unexpected input.
 */
export function renderBigLines(time: string): string[] {
  const rows = Array.from({ length: BIG_ROWS }, () => "");
  const chars = [...time];
  chars.forEach((ch, idx) => {
    const glyph = GLYPHS[ch] ?? [" ", " ", " ", " ", " "];
    const sep = idx < chars.length - 1 ? GAP : "";
    for (let r = 0; r < BIG_ROWS; r++) {
      rows[r] = (rows[r] ?? "") + (glyph[r] ?? "") + sep;
    }
  });
  return rows;
}

/** Width in columns of the rendered block for `time` (rows are equal width). */
export function bigWidth(time: string): number {
  return renderBigLines(time)[0]?.length ?? 0;
}
