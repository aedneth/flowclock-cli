import { describe, it, expect } from "vitest";
import {
  renderBigLines,
  renderOutlineLines,
  renderSimpleLines,
  renderClassicLines,
  renderBoldLines,
  renderCounter,
  styleWidth,
  styleBaseRows,
  bigWidth,
  computeScale,
  computeSessionScale,
  BIG_ROWS,
  BIG_MIN_COLS,
} from "../src/lib/bigfont.js";
import { renderBigFrame, ANSI } from "../src/lib/hud.js";

describe("renderBigLines", () => {
  it("produces BIG_ROWS equal-width rows at scale 1 (default)", () => {
    const lines = renderBigLines("12:34:56");
    expect(lines).toHaveLength(BIG_ROWS);
    const w = lines[0]!.length;
    expect(lines.every((l) => l.length === w)).toBe(true);
    expect(w).toBe(bigWidth("12:34:56"));
  });

  it("uses block characters for digits", () => {
    expect(renderBigLines("8").join("")).toContain("█");
  });

  it("HH:MM:SS base width equals BIG_MIN_COLS (scale-1 minimum)", () => {
    expect(bigWidth("00:00:00")).toBe(BIG_MIN_COLS);
  });

  it("never throws on unexpected characters", () => {
    expect(() => renderBigLines("ab")).not.toThrow();
    expect(renderBigLines("?")).toHaveLength(BIG_ROWS);
  });

  it("scale=2 doubles both width and height", () => {
    const s1 = renderBigLines("0", 1);
    const s2 = renderBigLines("0", 2);
    expect(s2.length).toBe(s1.length * 2);
    expect(s2[0]!.length).toBe(s1[0]!.length * 2);
  });
});

describe("computeScale", () => {
  it("returns 1 when only scale-1 fits", () => {
    // 60/33=1, 10/5=2 → 1
    expect(computeScale(60, 10, "00:00:00")).toBe(1);
  });

  it("returns 2 for a 100-col 30-row terminal", () => {
    // (100*0.75)/33=2, (30*0.50)/5=3 → 2
    expect(computeScale(100, 30, "00:00:00")).toBe(2);
  });

  it("caps at 3 for very large terminals", () => {
    expect(computeScale(9999, 9999, "00:00:00")).toBe(3);
  });

  it("is height-limited when rows is the binding constraint", () => {
    // (200*0.75)/33=4 (width allows 4), but (6*0.50)/5=0 → clamped to 1 (height-bound)
    expect(computeScale(200, 6, "00:00:00")).toBe(1);
  });
});

describe("computeSessionScale", () => {
  it("returns >= 1 for any input (large area)", () => {
    expect(computeSessionScale(200, 40, "00:00:00")).toBeGreaterThanOrEqual(1);
  });

  it("returns >= 1 for any input (tiny area)", () => {
    expect(computeSessionScale(10, 4, "00:00:00")).toBeGreaterThanOrEqual(1);
  });

  it("returns >= 1 when areaCols is smaller than one glyph width", () => {
    expect(computeSessionScale(1, 5, "00:00:00")).toBeGreaterThanOrEqual(1);
  });

  it("large area gives a larger scale than a small area", () => {
    const large = computeSessionScale(200, 40, "00:00:00");
    const small = computeSessionScale(40, 8, "00:00:00");
    expect(large).toBeGreaterThan(small);
  });

  it("respects maxScale option (caps at given value)", () => {
    // Without cap, 200x40 would give scale > 2; with maxScale:2 must cap at 2.
    const capped = computeSessionScale(200, 40, "00:00:00", { maxScale: 2 });
    expect(capped).toBeLessThanOrEqual(2);
    expect(capped).toBeGreaterThanOrEqual(1);
  });

  it("default cap is 4 (large terminal exceeds old cap-3 limit)", () => {
    // computeScale caps at 3; computeSessionScale caps at 4 by default.
    // On a very large terminal (9999x9999) with 92%/95% factors the col factor
    // easily reaches 4 before the 4-cap bites.
    const s = computeSessionScale(9999, 9999, "00:00:00");
    expect(s).toBe(4);
  });
});

describe("renderBigFrame", () => {
  it("renders the block font on a wide terminal", () => {
    const frame = renderBigFrame({ rows: 20, cols: 80, time: "12:34:56" });
    expect(frame).not.toBe("");
    expect(frame).toContain("█");
    expect(frame.startsWith(ANSI.clear)).toBe(true);
  });

  it("scales up on a large terminal", () => {
    const narrow = renderBigFrame({ rows: 20, cols: 80, time: "00:00:00" });
    const wide = renderBigFrame({ rows: 20, cols: 160, time: "00:00:00" });
    // wider terminal → more block characters
    expect(wide.length).toBeGreaterThan(narrow.length);
  });

  it("falls back (empty) when terminal is narrower than scale-1 minimum", () => {
    // "12:34:56" needs 33 cols at scale 1; 20 cols must fall back
    expect(renderBigFrame({ rows: 20, cols: 20, time: "12:34:56" })).toBe("");
  });

  it("falls back (empty) when too few rows", () => {
    expect(renderBigFrame({ rows: 3, cols: 80, time: "12:34:56" })).toBe("");
  });

  it("falls back for non-finite dimensions", () => {
    expect(renderBigFrame({ rows: NaN, cols: 80, time: "12:34:56" })).toBe("");
  });

  it("wraps each row in color when provided", () => {
    const frame = renderBigFrame({
      rows: 20,
      cols: 80,
      time: "00:00:00",
      colorOn: "\x1b[32m",
      colorOff: ANSI.reset,
    });
    expect(frame).toContain("\x1b[32m");
    expect(frame).toContain(ANSI.reset);
  });
});

describe("renderOutlineLines (hollow / outline style)", () => {
  it("matches the solid block's exact dimensions at the same scale", () => {
    for (const scale of [1, 2, 3]) {
      const solid = renderBigLines("12:34:56", scale);
      const outline = renderOutlineLines("12:34:56", scale);
      expect(outline).toHaveLength(solid.length);
      outline.forEach((line, i) => {
        expect(line.length).toBe(solid[i]!.length);
      });
      // Width parity with the block font keeps the reserve-first maths identical.
      expect(outline[0]!.length).toBe(bigWidth("12:34:56", scale));
    }
  });

  it("draws box-drawing line-art, never solid blocks", () => {
    const joined = renderOutlineLines("12:34:56", 2).join("");
    expect(joined).not.toContain("█");
    expect(/[─│┌┐└┘▫]/.test(joined)).toBe(true);
  });

  it("is visually DISTINCT from block at scale 1 (fixes the small-window toggle)", () => {
    // The OLD outline coincided with the solid block at scale 1–2; this must not.
    const outline = renderOutlineLines("12:34:56", 1).join("\n");
    const block = renderBigLines("12:34:56", 1).join("\n");
    expect(outline).not.toBe(block);
  });

  it("hollows out interiors at scale 3 (interior cells blanked)", () => {
    // The solid '8' is densely filled; the outline blanks its interior, so it
    // has strictly fewer ink cells than the solid block.
    const solidInk = renderBigLines("8", 3).join("").replace(/ /g, "").length;
    const outlineInk = renderOutlineLines("8", 3).join("").replace(/ /g, "").length;
    expect(outlineInk).toBeGreaterThan(0); // still a visible glyph
    expect(outlineInk).toBeLessThan(solidInk);
  });

  it("scale=2 doubles the row count", () => {
    expect(renderOutlineLines("0", 2).length).toBe(renderOutlineLines("0", 1).length * 2);
  });

  it("never throws on unexpected characters", () => {
    expect(() => renderOutlineLines("ab", 2)).not.toThrow();
  });

  it("scales cleanly at scale >= 2 — light-weight twin of simple, no heavy strokes", () => {
    // Regression: the old silhouette-of-block outline hollowed each one-cell
    // stroke into a doubled "tube" at scale >= 2 (garbled in tiled windows).
    // The seven-segment skeleton has its ink in the SAME cells as `simple`
    // (so it scales just as cleanly) but in LIGHT box-drawing characters.
    for (const scale of [1, 2, 3]) {
      const outline = renderOutlineLines("12:34:56", scale);
      const simple = renderSimpleLines("12:34:56", scale);
      const mask = (rows: string[]) =>
        rows.map((l) => [...l].map((c) => (c === " " ? " " : "#")).join(""));
      expect(mask(outline)).toEqual(mask(simple)); // identical skeleton → scales cleanly
      const joined = outline.join("");
      expect(/[┃━┏┓┗┛┣┫┳┻╋]/.test(joined)).toBe(false); // light strokes only
      expect(/[─│┌┐└┘]/.test(joined)).toBe(true);
    }
  });
});

describe("renderSimpleLines (heavy line / seven-segment style)", () => {
  it("matches the solid block's exact dimensions at the same scale", () => {
    for (const scale of [1, 2, 3]) {
      const solid = renderBigLines("12:34:56", scale);
      const line = renderSimpleLines("12:34:56", scale);
      expect(line).toHaveLength(solid.length);
      line.forEach((row, i) => {
        expect(row.length).toBe(solid[i]!.length);
      });
      // Width parity with the block font keeps the reserve-first maths identical.
      expect(line[0]!.length).toBe(bigWidth("12:34:56", scale));
    }
  });

  it("draws heavy box-drawing strokes, never solid blocks", () => {
    const joined = renderSimpleLines("12:34:56", 2).join("");
    expect(joined).not.toContain("█");
    expect(joined).toContain("┃");
    expect(joined).toContain("━");
  });

  it("renders colon dots", () => {
    expect(renderSimpleLines("00:00", 2).join("")).toContain("●");
  });

  it("is visually DISTINCT from block at scale 1 (fixes the small-window toggle)", () => {
    // The old outline coincided with block at scale 1; the line font must not.
    const line = renderSimpleLines("12:34:56", 1).join("\n");
    const block = renderBigLines("12:34:56", 1).join("\n");
    expect(line).not.toBe(block);
  });

  it("scale=2 doubles the row count", () => {
    expect(renderSimpleLines("0", 2).length).toBe(renderSimpleLines("0", 1).length * 2);
  });

  it("never throws on unexpected characters", () => {
    expect(() => renderSimpleLines("ab", 2)).not.toThrow();
    expect(renderSimpleLines("?")).toHaveLength(BIG_ROWS);
  });
});

describe("renderClassicLines / renderBoldLines (tall solid terminal fonts)", () => {
  it("classic is 9 rows tall at scale 1 and scales the row count by scale", () => {
    expect(renderClassicLines("12:34:56", 1)).toHaveLength(9);
    expect(renderClassicLines("0", 3)).toHaveLength(27);
    expect(styleBaseRows("classic")).toBe(9);
  });

  it("bold is 9 rows tall at scale 1 and scales the row count by scale", () => {
    expect(renderBoldLines("12:34:56", 1)).toHaveLength(9);
    expect(renderBoldLines("0", 2)).toHaveLength(18);
    expect(styleBaseRows("bold")).toBe(9);
  });

  it("rendered width exactly matches styleWidth (parity for reserve-first maths)", () => {
    for (const scale of [1, 2, 3]) {
      const c = renderClassicLines("12:34:56", scale);
      expect(c[0]!.length).toBe(styleWidth("classic", "12:34:56", scale));
      expect(c.every((l) => l.length === c[0]!.length)).toBe(true);

      const b = renderBoldLines("12:34:56", scale);
      expect(b[0]!.length).toBe(styleWidth("bold", "12:34:56", scale));
      expect(b.every((l) => l.length === b[0]!.length)).toBe(true);
    }
  });

  it("uses solid block characters, no box-drawing line art", () => {
    const c = renderClassicLines("8", 2).join("");
    expect(c).toContain("█");
    expect(/[─│┌┐└┘┃━]/.test(c)).toBe(false);
    const b = renderBoldLines("8", 2).join("");
    expect(b).toContain("█");
  });

  it("bold is heavier than classic (more ink for the same time)", () => {
    const ink = (rows: string[]) => rows.join("").replace(/ /g, "").length;
    expect(ink(renderBoldLines("12:34:56", 1))).toBeGreaterThan(ink(renderClassicLines("12:34:56", 1)));
  });

  it("classic and bold are visually distinct from block, simple, outline", () => {
    const samples = ["12:34:56"] as const;
    for (const t of samples) {
      const classic = renderClassicLines(t, 2).join("\n");
      const bold = renderBoldLines(t, 2).join("\n");
      expect(classic).not.toBe(bold);
      // distinct dimensions from the 5-row families guarantees distinctness
      expect(renderClassicLines(t, 1).length).not.toBe(renderBigLines(t, 1).length);
    }
  });

  it("never throws on unexpected characters", () => {
    expect(() => renderClassicLines("ab", 2)).not.toThrow();
    expect(() => renderBoldLines("??", 3)).not.toThrow();
    expect(renderClassicLines("?")).toHaveLength(9);
  });
});

describe("renderCounter (style dispatcher)", () => {
  it("dispatches each style to its renderer", () => {
    const t = "12:34:56";
    expect(renderCounter("block", t, 2)).toEqual(renderBigLines(t, 2));
    expect(renderCounter("simple", t, 2)).toEqual(renderSimpleLines(t, 2));
    expect(renderCounter("outline", t, 2)).toEqual(renderOutlineLines(t, 2));
    expect(renderCounter("classic", t, 2)).toEqual(renderClassicLines(t, 2));
    expect(renderCounter("bold", t, 2)).toEqual(renderBoldLines(t, 2));
  });
});

describe("computeSessionScale — style-aware", () => {
  it("block width matches the legacy bigWidth (back-compat)", () => {
    expect(styleWidth("block", "00:00:00", 1)).toBe(bigWidth("00:00:00", 1));
  });

  it("tall classic font yields a smaller scale than block in the same area", () => {
    // 9-row classic needs more vertical room per scale step than 5-row block.
    const area = { c: 120, r: 24 } as const;
    const blockScale = computeSessionScale(area.c, area.r, "00:00:00", { style: "block" });
    const classicScale = computeSessionScale(area.c, area.r, "00:00:00", { style: "classic" });
    expect(classicScale).toBeLessThanOrEqual(blockScale);
  });

  it("still returns >= 1 for every style on a tiny area", () => {
    for (const style of ["block", "simple", "outline", "classic", "bold"] as const) {
      expect(computeSessionScale(10, 4, "00:00:00", { style })).toBeGreaterThanOrEqual(1);
    }
  });
});
