import { describe, it, expect } from "vitest";
import {
  renderBigLines,
  renderOutlineLines,
  renderSimpleLines,
  renderMinimalLines,
  renderClassicLines,
  renderBoldLines,
  renderCounter,
  styleWidth,
  styleBaseRows,
  bigWidth,
  computeScale,
  computeSessionScale,
  uniformCounterScale,
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
    // v3.4.1: outline now uses DOUBLE-LINE box-drawing chars (╔═╗ ║ ╚╝)
    expect(/[═║╔╗╚╝▫]/.test(joined)).toBe(true);
  });

  it("v3.4.1 — outline is DISTINCT from minimal at scale 1 (double-line vs light single-line)", () => {
    // Bug 1 regression guard: the old single-line outline was byte-identical to
    // the `minimal` font at scale 1, making the two styles indistinguishable in
    // a minimized window. Double-line chars fix this at every scale.
    const outlineJoined = renderOutlineLines("12:34:56", 1).join("\n");
    const minimalJoined = renderMinimalLines("12:34:56", 1).join("\n");
    expect(outlineJoined).not.toBe(minimalJoined);
    // Outline must contain at least one double-line char that minimal never has.
    expect(/[═║╔╗╚╝]/.test(outlineJoined)).toBe(true);
    expect(/[═║╔╗╚╝]/.test(minimalJoined)).toBe(false);
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

describe("renderMinimalLines (light seven-segment style)", () => {
  it("matches the solid block's exact dimensions at scales 1, 2, 3", () => {
    for (const scale of [1, 2, 3]) {
      const solid = renderBigLines("12:34:56", scale);
      const minimal = renderMinimalLines("12:34:56", scale);
      expect(minimal).toHaveLength(solid.length);
      minimal.forEach((row, i) => {
        expect(row.length).toBe(solid[i]!.length);
      });
      expect(minimal[0]!.length).toBe(bigWidth("12:34:56", scale));
    }
  });

  it("is the LIGHT-weight twin of simple — same ink-cell mask at scales 1, 2, 3", () => {
    const mask = (rows: string[]) =>
      rows.map((l) => [...l].map((c) => (c === " " ? " " : "#")).join(""));
    for (const scale of [1, 2, 3]) {
      expect(mask(renderMinimalLines("12:34:56", scale))).toEqual(
        mask(renderSimpleLines("12:34:56", scale)),
      );
    }
  });

  it("uses LIGHT box-drawing only — no heavy strokes", () => {
    const joined = renderMinimalLines("12:34:56", 2).join("");
    expect(/[─│┌┐└┘]/.test(joined)).toBe(true);
    expect(/[┃━┏┓┗┛┣┫┳┻╋]/.test(joined)).toBe(false);
  });

  it("is visually DISTINCT from block at scale 1", () => {
    expect(renderMinimalLines("12:34:56", 1).join("\n")).not.toBe(
      renderBigLines("12:34:56", 1).join("\n"),
    );
  });

  it("never throws on unexpected characters", () => {
    expect(() => renderMinimalLines("ab", 2)).not.toThrow();
    expect(renderMinimalLines("?")).toHaveLength(BIG_ROWS);
  });
});

// ---------------------------------------------------------------------------
// renderClassicLines / renderBoldLines — native 5-row distinct-shape fonts
//
// These are native 5-row fonts with distinct glyph shapes from block (cornered
// classic, heavy-slab bold), both inked solid █, sharing block's exact 5-row ×
// 4-col footprint. No shade chars (░ ▒ ▓) — every filled cell is █.
// ---------------------------------------------------------------------------

describe("renderClassicLines / renderBoldLines (native 5-row distinct-shape fonts)", () => {
  it("classic is 5 rows tall at scale 1 — same as block (styleBaseRows == BIG_ROWS)", () => {
    expect(renderClassicLines("12:34:56", 1)).toHaveLength(BIG_ROWS);
    expect(renderClassicLines("0", 3)).toHaveLength(BIG_ROWS * 3);
    expect(styleBaseRows("classic")).toBe(BIG_ROWS);
    expect(styleBaseRows("classic")).toBe(styleBaseRows("block"));
  });

  it("bold is 5 rows tall at scale 1 — same as block (styleBaseRows == BIG_ROWS)", () => {
    expect(renderBoldLines("12:34:56", 1)).toHaveLength(BIG_ROWS);
    expect(renderBoldLines("0", 2)).toHaveLength(BIG_ROWS * 2);
    expect(styleBaseRows("bold")).toBe(BIG_ROWS);
    expect(styleBaseRows("bold")).toBe(styleBaseRows("block"));
  });

  it("styleWidth for classic and bold equals styleWidth for block (same footprint)", () => {
    const t = "12:34:56";
    for (const scale of [1, 2, 3]) {
      expect(styleWidth("classic", t, scale)).toBe(styleWidth("block", t, scale));
      expect(styleWidth("bold", t, scale)).toBe(styleWidth("block", t, scale));
    }
  });

  it("classic row count equals block row count at scales 1, 2, 3", () => {
    const t = "12:34:56";
    for (const scale of [1, 2, 3]) {
      expect(renderClassicLines(t, scale).length).toBe(renderBigLines(t, scale).length);
    }
  });

  it("bold row count equals block row count at scales 1, 2, 3", () => {
    const t = "12:34:56";
    for (const scale of [1, 2, 3]) {
      expect(renderBoldLines(t, scale).length).toBe(renderBigLines(t, scale).length);
    }
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

  it("classic and bold ink with solid █ (no shade chars, no box-drawing)", () => {
    const c = renderClassicLines("8", 2).join("");
    expect(c).toContain("█");
    expect(c).not.toContain("░");
    expect(c).not.toContain("▒");
    expect(c).not.toContain("▓");
    expect(/[─│┌┐└┘┃━╔╗╚╝║═]/.test(c)).toBe(false);

    const b = renderBoldLines("8", 2).join("");
    expect(b).toContain("█");
    expect(b).not.toContain("░");
    expect(b).not.toContain("▒");
    expect(b).not.toContain("▓");
    expect(/[─│┌┐└┘┃━╔╗╚╝║═]/.test(b)).toBe(false);
  });

  it("classic glyphs differ from block glyphs (distinct shape, not a re-inked block)", () => {
    const t = "12:34:56";
    // Both use █, so plain inequality proves distinct shape (not just a re-ink).
    expect(renderClassicLines(t, 1)).not.toEqual(renderBigLines(t, 1));
    // Spot-check individual digit shapes differ.
    expect(renderClassicLines("4", 1)).not.toEqual(renderBigLines("4", 1));
  });

  it("bold glyphs differ from block glyphs (distinct shape, heavier weight)", () => {
    const t = "12:34:56";
    // Both use █, so plain inequality proves distinct shape.
    expect(renderBoldLines(t, 1)).not.toEqual(renderBigLines(t, 1));
    // Bold and classic must also differ from each other.
    expect(renderBoldLines("1", 1)).not.toEqual(renderClassicLines("1", 1));
  });

  it("classic and bold are visually distinct from block and from each other", () => {
    const t = "12:34:56";
    const classic = renderClassicLines(t, 1).join("\n");
    const bold = renderBoldLines(t, 1).join("\n");
    const block = renderBigLines(t, 1).join("\n");
    expect(classic).not.toBe(bold);
    expect(classic).not.toBe(block);
    expect(bold).not.toBe(block);
  });

  it("never throws on unexpected characters", () => {
    expect(() => renderClassicLines("ab", 2)).not.toThrow();
    expect(() => renderBoldLines("??", 3)).not.toThrow();
    expect(renderClassicLines("?")).toHaveLength(BIG_ROWS);
  });
});

describe("renderCounter (style dispatcher)", () => {
  it("dispatches each style to its renderer", () => {
    const t = "12:34:56";
    expect(renderCounter("block", t, 2)).toEqual(renderBigLines(t, 2));
    expect(renderCounter("simple", t, 2)).toEqual(renderSimpleLines(t, 2));
    expect(renderCounter("outline", t, 2)).toEqual(renderOutlineLines(t, 2));
    expect(renderCounter("minimal", t, 2)).toEqual(renderMinimalLines(t, 2));
    expect(renderCounter("classic", t, 2)).toEqual(renderClassicLines(t, 2));
    expect(renderCounter("bold", t, 2)).toEqual(renderBoldLines(t, 2));
  });
});

describe("computeSessionScale — style-aware", () => {
  it("block width matches the legacy bigWidth (back-compat)", () => {
    expect(styleWidth("block", "00:00:00", 1)).toBe(bigWidth("00:00:00", 1));
  });

  it("classic and bold yield the SAME scale as block — all share the 5-row footprint", () => {
    // All styles now share the identical 5-row × 4-col footprint, so
    // computeSessionScale must return the same value for block, classic, and bold.
    const area = { c: 120, r: 24 } as const;
    const blockScale = computeSessionScale(area.c, area.r, "00:00:00", { style: "block" });
    const classicScale = computeSessionScale(area.c, area.r, "00:00:00", { style: "classic" });
    const boldScale = computeSessionScale(area.c, area.r, "00:00:00", { style: "bold" });
    expect(classicScale).toBe(blockScale);
    expect(boldScale).toBe(blockScale);
  });

  it("still returns >= 1 for every style on a tiny area", () => {
    for (const style of ["block", "simple", "outline", "classic", "bold"] as const) {
      expect(computeSessionScale(10, 4, "00:00:00", { style })).toBeGreaterThanOrEqual(1);
    }
  });
});

describe("uniformCounterScale — consistent footprint across styles", () => {
  it("all styles return the same scale as computeSessionScale (all share 5-row footprint)", () => {
    const time = "00:00:00";
    for (const area of [{ c: 98, r: 23 }, { c: 120, r: 31 }] as const) {
      for (const style of ["block", "simple", "outline", "minimal", "classic", "bold"] as const) {
        const expected = computeSessionScale(area.c, area.r, time, { style });
        expect(uniformCounterScale(area.c, area.r, time, style)).toBe(expected);
      }
    }
  });

  it("classic and bold return the SAME scale as block (no tall-font taming needed)", () => {
    // uniformCounterScale is now a thin wrapper over computeSessionScale.
    // Because all styles share the 5-row footprint, classic and bold get the
    // same scale as block — no floor() taming is applied.
    const cols = 98, rows = 23, time = "00:29:35";
    const blockScale = uniformCounterScale(cols, rows, time, "block");
    const classicScale = uniformCounterScale(cols, rows, time, "classic");
    const boldScale = uniformCounterScale(cols, rows, time, "bold");
    expect(classicScale).toBe(blockScale);
    expect(boldScale).toBe(blockScale);
  });

  it("returns >= 1 for every style on a tiny area", () => {
    for (const style of ["block", "simple", "outline", "minimal", "classic", "bold"] as const) {
      expect(uniformCounterScale(10, 4, "00:00:00", style)).toBeGreaterThanOrEqual(1);
    }
  });

  it("v3.5 — classic and bold now equal block at cols=120, rows=30 (unified footprint)", () => {
    // The old v3.4.1 floor() taming that kept classic at scale 1 when block was
    // at scale 3 is gone. Now both are at scale 3.
    const cols = 120, rows = 30, time = "00:00:00";
    const blockScale = uniformCounterScale(cols, rows, time, "block");
    const classicScale = uniformCounterScale(cols, rows, time, "classic");
    const boldScale = uniformCounterScale(cols, rows, time, "bold");
    expect(classicScale).toBe(blockScale);
    expect(boldScale).toBe(blockScale);
  });
});
