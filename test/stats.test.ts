import { describe, it, expect } from "vitest";
import { computeStats } from "../src/lib/stats.js";
import { SessionSchema, type Session } from "../src/schemas/session.js";

function s(durationS: number, start: string): Session {
  return SessionSchema.parse({
    id: start,
    start,
    end: new Date(new Date(start).getTime() + durationS * 1000).toISOString(),
    durationS,
    source: "log",
  });
}

describe("computeStats", () => {
  const now = new Date("2026-05-31T12:00:00.000Z");

  it("returns zeros for an empty list", () => {
    const r = computeStats([], now);
    expect(r.allTimeCount).toBe(0);
    expect(r.averageSessionS).toBe(0);
    expect(r.week).toHaveLength(7);
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
      [s(600, "2026-05-31T08:00:00.000Z"), s(900, "2026-05-30T08:00:00.000Z")],
      now,
    );
    expect(r.todayCount).toBe(1);
    expect(r.todayTotalS).toBe(600);
  });

  it("produces a 7-day window ending today", () => {
    const r = computeStats([], now);
    expect(r.week[6]!.date).toBe("2026-05-31");
    expect(r.week[0]!.date).toBe("2026-05-25");
  });
});
