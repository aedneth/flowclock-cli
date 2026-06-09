import { describe, it, expect } from "vitest";
import { buildSnapshot } from "../src/lib/snapshot.js";
import { SessionSchema, type Session } from "../src/schemas/session.js";

function s(opts: {
  start: string;
  durationS: number;
  breakS?: number;
}): Session {
  const start = new Date(opts.start);
  const end = new Date(start.getTime() + opts.durationS * 1000);
  return SessionSchema.parse({
    id: `id-${opts.start}`,
    start: opts.start,
    end: end.toISOString(),
    durationS: opts.durationS,
    source: "log",
    breakS: opts.breakS ?? 0,
  });
}

const NOW = new Date("2026-06-09T12:00:00.000Z");
const DAILY_GOAL = 14400;

describe("buildSnapshot", () => {
  it("returns a snapshot with all required top-level keys", () => {
    const snap = buildSnapshot([], DAILY_GOAL, NOW);
    expect(snap).toHaveProperty("generatedAt");
    expect(snap).toHaveProperty("stats");
    expect(snap).toHaveProperty("game");
    expect(snap).toHaveProperty("goals");
    expect(snap).toHaveProperty("recent");
  });

  it("generatedAt is the injected now ISO string", () => {
    const snap = buildSnapshot([], DAILY_GOAL, NOW);
    expect(snap.generatedAt).toBe(NOW.toISOString());
  });

  it("recent is empty when no sessions", () => {
    const snap = buildSnapshot([], DAILY_GOAL, NOW);
    expect(snap.recent).toHaveLength(0);
  });

  it("recent is at most 20 sessions (newest first)", () => {
    const sessions = Array.from({ length: 25 }, (_, i) =>
      s({
        start: new Date(Date.UTC(2026, 0, 1) + i * 3_600_000).toISOString(),
        durationS: 1800,
      }),
    );
    const snap = buildSnapshot(sessions, DAILY_GOAL, NOW);
    expect(snap.recent).toHaveLength(20);
    // newest first
    expect(new Date(snap.recent[0]!.start) > new Date(snap.recent[1]!.start)).toBe(true);
  });

  it("stats reflects total session count", () => {
    const sessions = [
      s({ start: "2026-06-01T10:00:00.000Z", durationS: 1800 }),
      s({ start: "2026-06-02T10:00:00.000Z", durationS: 900 }),
    ];
    const snap = buildSnapshot(sessions, DAILY_GOAL, NOW);
    expect(snap.stats.allTimeCount).toBe(2);
    expect(snap.stats.allTimeTotalS).toBe(2700);
  });

  it("goals are empty when no sessions have a goal", () => {
    const sessions = [s({ start: "2026-06-01T10:00:00.000Z", durationS: 1800 })];
    const snap = buildSnapshot(sessions, DAILY_GOAL, NOW);
    expect(snap.goals).toHaveLength(0);
  });

  it("game object has expected shape", () => {
    const snap = buildSnapshot([], DAILY_GOAL, NOW);
    expect(snap.game).toHaveProperty("flowScore");
    expect(snap.game).toHaveProperty("dailyMaximizationPct");
    expect(snap.game).toHaveProperty("focusRestRatioToday");
    expect(snap.game).toHaveProperty("focusRestRatioAllTime");
    expect(snap.game).toHaveProperty("achievements");
    expect(snap.game.achievements).toHaveLength(6);
  });
});
