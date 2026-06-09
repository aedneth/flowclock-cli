import { describe, it, expect } from "vitest";
import { breakBand, suggestBreakS, breakRatio } from "../src/lib/flowtime.js";

describe("breakBand", () => {
  it("returns {300,300} for focus < 25 min", () => {
    expect(breakBand(0)).toEqual({ minS: 300, maxS: 300 });
    expect(breakBand(60)).toEqual({ minS: 300, maxS: 300 }); // 1 min
    expect(breakBand(24 * 60 - 1)).toEqual({ minS: 300, maxS: 300 }); // 24m 59s
    expect(breakBand(24 * 60)).toEqual({ minS: 300, maxS: 300 }); // 24m exactly
  });

  it("returns {480,600} for 25–49 min focus", () => {
    expect(breakBand(25 * 60)).toEqual({ minS: 480, maxS: 600 }); // 25m exactly
    expect(breakBand(30 * 60)).toEqual({ minS: 480, maxS: 600 }); // 30m
    expect(breakBand(49 * 60 + 59)).toEqual({ minS: 480, maxS: 600 }); // 49m 59s
  });

  it("returns {600,900} for 50–89 min focus", () => {
    expect(breakBand(50 * 60)).toEqual({ minS: 600, maxS: 900 }); // 50m exactly
    expect(breakBand(60 * 60)).toEqual({ minS: 600, maxS: 900 }); // 60m
    expect(breakBand(89 * 60 + 59)).toEqual({ minS: 600, maxS: 900 }); // 89m 59s
  });

  it("returns {900,1800} for >= 90 min focus", () => {
    expect(breakBand(90 * 60)).toEqual({ minS: 900, maxS: 1800 }); // 90m exactly
    expect(breakBand(120 * 60)).toEqual({ minS: 900, maxS: 1800 }); // 2h
    expect(breakBand(180 * 60)).toEqual({ minS: 900, maxS: 1800 }); // 3h
  });
});

describe("suggestBreakS", () => {
  it("returns 300 for focus < 25 min (midpoint of {300,300})", () => {
    expect(suggestBreakS(0)).toBe(300);
    expect(suggestBreakS(20 * 60)).toBe(300);
  });

  it("returns 540 for 25–49 min focus (midpoint of {480,600})", () => {
    expect(suggestBreakS(25 * 60)).toBe(540);
    expect(suggestBreakS(30 * 60)).toBe(540);
  });

  it("returns 750 for 50–89 min focus (midpoint of {600,900})", () => {
    expect(suggestBreakS(50 * 60)).toBe(750);
    expect(suggestBreakS(60 * 60)).toBe(750);
  });

  it("returns 1350 for >= 90 min focus (midpoint of {900,1800})", () => {
    expect(suggestBreakS(90 * 60)).toBe(1350);
    expect(suggestBreakS(120 * 60)).toBe(1350);
  });
});

describe("breakRatio", () => {
  it("returns 0 when focusS is 0", () => {
    expect(breakRatio(0, 300)).toBe(0);
    expect(breakRatio(-1, 300)).toBe(0);
  });

  it("returns the correct ratio", () => {
    expect(breakRatio(1500, 300)).toBeCloseTo(0.2);
    expect(breakRatio(3000, 600)).toBeCloseTo(0.2);
    expect(breakRatio(1000, 500)).toBeCloseTo(0.5);
  });

  it("returns 0 when breakS is 0", () => {
    expect(breakRatio(1500, 0)).toBe(0);
  });
});
