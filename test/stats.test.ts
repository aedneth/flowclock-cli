import { describe, it, expect } from "vitest";
import { computeStats, computeStreaks } from "../src/lib/stats.js";
import { SessionSchema, type Session } from "../src/schemas/session.js";

function s(durationS: number, start: string, breakS = 0): Session {
  return SessionSchema.parse({
    id: start,
    start,
    end: new Date(new Date(start).getTime() + durationS * 1000).toISOString(),
    durationS,
    source: "log",
    breakS,
  });
}

describe("computeStats", () => {
  const now = new Date("2026-05-31T12:00:00.000Z");

  it("returns zeros for an empty list", () => {
    const r = computeStats([], now);
    expect(r.allTimeCount).toBe(0);
    expect(r.averageSessionS).toBe(0);
    expect(r.week).toHaveLength(7);
    expect(r.todayBreakS).toBe(0);
    expect(r.allTimeBreakS).toBe(0);
    expect(r.focusRestRatioAllTime).toBe(0);
  });

  it("aggregates totals, best, and average", () => {
    const r = computeStats(
      [
        s(600, "2026-05-31T08:00:00.000Z"),
        s(1800, "2026-05-31T09:00:00.000Z"),
        s(300, "2026-05-20T09:00:00.000Z"),
      ],
      now,
    );
    expect(r.allTimeTotalS).toBe(2700);
    expect(r.allTimeCount).toBe(3);
    expect(r.bestSessionS).toBe(1800);
    expect(r.averageSessionS).toBe(900);
  });

  it("counts today separately from all-time", () => {
    const r = computeStats(
      [s(600, "2026-05-31T08:00:00.000Z", 120), s(900, "2026-05-30T08:00:00.000Z", 300)],
      now,
    );
    expect(r.todayCount).toBe(1);
    expect(r.todayTotalS).toBe(600);
    expect(r.todayBreakS).toBe(120);
    expect(r.allTimeBreakS).toBe(420);
  });

  it("computes focusRestRatioAllTime correctly", () => {
    // 1800s focus total, 600s break total → ratio = 3
    const r = computeStats(
      [s(900, "2026-05-31T08:00:00.000Z", 300), s(900, "2026-05-30T08:00:00.000Z", 300)],
      now,
    );
    expect(r.allTimeBreakS).toBe(600);
    expect(r.focusRestRatioAllTime).toBeCloseTo(3, 5);
  });

  it("focusRestRatioAllTime is 0 when no breaks", () => {
    const r = computeStats([s(600, "2026-05-31T08:00:00.000Z")], now);
    expect(r.focusRestRatioAllTime).toBe(0);
  });

  it("produces a 7-day window ending today", () => {
    const r = computeStats([], now);
    expect(r.week[6]!.date).toBe("2026-05-31");
    expect(r.week[0]!.date).toBe("2026-05-25");
  });
});

describe("computeStreaks", () => {
  // Build a local YYYY-MM-DD key for `now` shifted by `offsetDays` — mirrors
  // how computeStats derives day keys, so the test is timezone-robust.
  const now = new Date("2026-05-31T12:00:00.000Z");
  function key(offsetDays: number): string {
    const d = new Date(now);
    d.setDate(d.getDate() + offsetDays);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }

  it("is zero with no active days (first run)", () => {
    expect(computeStreaks([], now)).toEqual({
      current: 0,
      longest: 0,
      lastSessionDate: null,
    });
  });

  it("counts a current streak ending today", () => {
    const r = computeStreaks([key(0), key(-1), key(-2)], now);
    expect(r.current).toBe(3);
    expect(r.longest).toBe(3);
    expect(r.lastSessionDate).toBe(key(0));
  });

  it("keeps the streak current when the last active day was yesterday", () => {
    const r = computeStreaks([key(-1), key(-2)], now);
    expect(r.current).toBe(2);
  });

  it("breaks the current streak after a gap but keeps longest", () => {
    // active: today, then a 3-day run two weeks ago
    const r = computeStreaks([key(0), key(-10), key(-11), key(-12)], now);
    expect(r.current).toBe(1); // only today is current
    expect(r.longest).toBe(3); // the old run
  });

  it("returns current 0 when the most recent active day is stale", () => {
    const r = computeStreaks([key(-5), key(-6)], now);
    expect(r.current).toBe(0);
    expect(r.longest).toBe(2);
    expect(r.lastSessionDate).toBe(key(-5));
  });

  it("dedupes multiple sessions on the same day", () => {
    const r = computeStreaks([key(0), key(0), key(-1)], now);
    expect(r.current).toBe(2);
    expect(r.longest).toBe(2);
  });
});
