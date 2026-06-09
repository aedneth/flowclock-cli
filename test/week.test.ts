import { describe, it, expect } from "vitest";
import {
  parseIsoWeek,
  currentIsoWeek,
  isoWeekToMonday,
  weekDayKeys,
  dateKey,
  mondayOf,
} from "../src/lib/week.js";
import { summarizeWeek } from "../src/commands/summary.js";
import { SessionSchema, type Session } from "../src/schemas/session.js";

function s(start: string, durationS: number, goal?: string, breakS = 0): Session {
  return SessionSchema.parse({
    id: start,
    start,
    end: new Date(new Date(start).getTime() + durationS * 1000).toISOString(),
    durationS,
    source: "log",
    goal: goal ?? null,
    breakS,
  });
}

describe("ISO week math", () => {
  it("round-trips currentIsoWeek → isoWeekToMonday", () => {
    const w = currentIsoWeek(new Date("2026-06-03T12:00:00.000Z"));
    const monday = isoWeekToMonday(w.year, w.week);
    // The Monday's own ISO week equals the week we started from.
    expect(currentIsoWeek(monday)).toEqual(w);
    expect(mondayOf(monday).getTime()).toBe(monday.getTime());
  });

  it("week 1 contains January 4th", () => {
    const monday = isoWeekToMonday(2026, 1);
    const keys = weekDayKeys(monday);
    expect(keys).toContain("2026-01-04");
  });

  it("parses YYYY-WW and YYYY-Www", () => {
    expect(parseIsoWeek("2026-23")).toBeInstanceOf(Date);
    expect(parseIsoWeek("2026-W23")).toBeInstanceOf(Date);
  });

  it("rejects malformed or out-of-range weeks", () => {
    expect(parseIsoWeek("garbage")).toBeNull();
    expect(parseIsoWeek("2026-00")).toBeNull();
    expect(parseIsoWeek("2026-54")).toBeNull();
  });

  it("produces 7 Mon→Sun day keys", () => {
    const monday = isoWeekToMonday(2026, 23);
    const keys = weekDayKeys(monday);
    expect(keys).toHaveLength(7);
    expect(keys[0]).toBe(dateKey(monday));
  });
});

describe("summarizeWeek", () => {
  // A real ISO timestamp at local 10:00 on `monday`, so its local date-key is
  // the week's first day regardless of the test machine's timezone.
  function day0Iso(monday: Date): string {
    const d = new Date(monday);
    d.setHours(10, 0, 0, 0);
    return d.toISOString();
  }

  it("buckets sessions into the right day with totals/best/goal", () => {
    const monday = isoWeekToMonday(2026, 23);
    const day0 = day0Iso(monday);
    const rows = summarizeWeek(
      [s(day0, 600, "Deep work"), s(day0, 1200, "Deep work")],
      monday,
    );
    expect(rows).toHaveLength(7);
    expect(rows[0]).toMatchObject({
      date: weekDayKeys(monday)[0],
      sessions: 2,
      totalS: 1800,
      bestS: 1200,
      goal: "Deep work",
    });
    // Other days are empty.
    expect(rows[1]!.sessions).toBe(0);
  });

  it("leaves goal blank when no session named one", () => {
    const monday = isoWeekToMonday(2026, 23);
    const rows = summarizeWeek([s(day0Iso(monday), 300)], monday);
    expect(rows[0]!.goal).toBe("");
  });

  it("sums breakS per day", () => {
    const monday = isoWeekToMonday(2026, 23);
    const day0 = day0Iso(monday);
    const rows = summarizeWeek(
      [s(day0, 3600, undefined, 300), s(day0, 1800, undefined, 120)],
      monday,
    );
    expect(rows[0]!.breakS).toBe(420);
    expect(rows[1]!.breakS).toBe(0);
  });
});
