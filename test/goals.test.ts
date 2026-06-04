import { describe, it, expect } from "vitest";
import { summarizeGoals } from "../src/commands/goals.js";
import { SessionSchema, type Session } from "../src/schemas/session.js";

function s(opts: {
  start: string;
  durationS: number;
  goal?: string | null;
  goalMet?: boolean | null;
}): Session {
  return SessionSchema.parse({
    id: `id-${opts.start}`,
    start: opts.start,
    end: new Date(
      new Date(opts.start).getTime() + opts.durationS * 1000,
    ).toISOString(),
    durationS: opts.durationS,
    source: "log",
    goal: opts.goal ?? null,
    goalMet: opts.goalMet ?? null,
  });
}

describe("summarizeGoals", () => {
  it("ignores sessions without a goal", () => {
    const out = summarizeGoals([
      s({ start: "2026-06-01T10:00:00.000Z", durationS: 60 }),
    ]);
    expect(out).toEqual([]);
  });

  it("aggregates count, total, and met/missed/neutral tallies", () => {
    const out = summarizeGoals([
      s({ start: "2026-06-01T10:00:00.000Z", durationS: 60, goal: "A", goalMet: true }),
      s({ start: "2026-06-02T10:00:00.000Z", durationS: 120, goal: "A", goalMet: false }),
      s({ start: "2026-06-03T10:00:00.000Z", durationS: 30, goal: "A" }),
    ]);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({
      goal: "A",
      count: 3,
      totalS: 210,
      met: 1,
      missed: 1,
      neutral: 1,
      lastUsed: "2026-06-03T10:00:00.000Z",
    });
  });

  it("orders goals by most recently used", () => {
    const out = summarizeGoals([
      s({ start: "2026-06-01T10:00:00.000Z", durationS: 60, goal: "old" }),
      s({ start: "2026-06-05T10:00:00.000Z", durationS: 60, goal: "new" }),
    ]);
    expect(out.map((g) => g.goal)).toEqual(["new", "old"]);
  });
});
