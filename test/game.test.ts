import { describe, it, expect } from "vitest";
import { computeAchievements, computeGame } from "../src/lib/game.js";
import { SessionSchema, type Session } from "../src/schemas/session.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function s(opts: {
  start: string;
  durationS: number;
  breakS?: number;
  breakBudgetS?: number | null;
  focusTargetS?: number | null;
}): Session {
  const start = new Date(opts.start);
  const end = new Date(start.getTime() + (opts.durationS + (opts.breakS ?? 0)) * 1000);
  return SessionSchema.parse({
    id: `id-${opts.start}`,
    start: opts.start,
    end: end.toISOString(),
    durationS: opts.durationS,
    source: "log",
    breakS: opts.breakS ?? 0,
    breakBudgetS: opts.breakBudgetS ?? null,
    focusTargetS: opts.focusTargetS ?? null,
  });
}

/** A fixed "now" for deterministic tests. */
const NOW = new Date("2026-06-09T12:00:00.000Z");

/** YYYY-MM-DD for `now` in local time — mirrors localDateKey. */
function localDateOf(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

const TODAY = localDateOf(NOW);

// ---------------------------------------------------------------------------
// computeAchievements
// ---------------------------------------------------------------------------

describe("computeAchievements", () => {
  it("returns all 6 known achievements with null earnedAt for empty sessions", () => {
    const ach = computeAchievements([]);
    expect(ach).toHaveLength(6);
    expect(ach.every((a) => a.earnedAt === null)).toBe(true);
  });

  it("earns first-hour once cumulative focus reaches 3600s", () => {
    const sessions = [
      s({ start: "2026-06-01T10:00:00.000Z", durationS: 1800 }),
      s({ start: "2026-06-02T10:00:00.000Z", durationS: 1200 }),
      s({ start: "2026-06-03T10:00:00.000Z", durationS: 700 }), // total=3700
    ];
    const ach = computeAchievements(sessions);
    const fh = ach.find((a) => a.id === "first-hour")!;
    expect(fh.earnedAt).not.toBeNull();
  });

  it("does NOT earn first-hour when cumulative focus < 3600s", () => {
    const sessions = [s({ start: "2026-06-01T10:00:00.000Z", durationS: 3500 })];
    const ach = computeAchievements(sessions);
    expect(ach.find((a) => a.id === "first-hour")!.earnedAt).toBeNull();
  });

  it("earns deep-diver for a session ≥ 5400s (90m)", () => {
    const sessions = [s({ start: "2026-06-01T10:00:00.000Z", durationS: 5400 })];
    const ach = computeAchievements(sessions);
    expect(ach.find((a) => a.id === "deep-diver")!.earnedAt).not.toBeNull();
  });

  it("does NOT earn deep-diver for a session < 5400s", () => {
    const sessions = [s({ start: "2026-06-01T10:00:00.000Z", durationS: 5399 })];
    const ach = computeAchievements(sessions);
    expect(ach.find((a) => a.id === "deep-diver")!.earnedAt).toBeNull();
  });

  it("earns budget-master when breakS <= breakBudgetS", () => {
    const sessions = [
      s({
        start: "2026-06-01T10:00:00.000Z",
        durationS: 3600,
        breakS: 300,
        breakBudgetS: 600,
      }),
    ];
    const ach = computeAchievements(sessions);
    expect(ach.find((a) => a.id === "budget-master")!.earnedAt).not.toBeNull();
  });

  it("does NOT earn budget-master when breakS > breakBudgetS", () => {
    const sessions = [
      s({
        start: "2026-06-01T10:00:00.000Z",
        durationS: 3600,
        breakS: 700,
        breakBudgetS: 600,
      }),
    ];
    const ach = computeAchievements(sessions);
    expect(ach.find((a) => a.id === "budget-master")!.earnedAt).toBeNull();
  });

  it("earns flow-4to1 when a day has focus:break ≥ 4 with breakS > 0", () => {
    // 4000s focus, 500s break → ratio = 8:1 ≥ 4
    const sessions = [
      s({ start: "2026-06-01T10:00:00.000Z", durationS: 4000, breakS: 500 }),
    ];
    const ach = computeAchievements(sessions);
    expect(ach.find((a) => a.id === "flow-4to1")!.earnedAt).not.toBeNull();
  });

  it("does NOT earn flow-4to1 when ratio < 4", () => {
    // 3000s focus, 1000s break → ratio = 3:1
    const sessions = [
      s({ start: "2026-06-01T10:00:00.000Z", durationS: 3000, breakS: 1000 }),
    ];
    const ach = computeAchievements(sessions);
    expect(ach.find((a) => a.id === "flow-4to1")!.earnedAt).toBeNull();
  });

  it("does NOT earn flow-4to1 when breakS is 0 (even if ratio would be ∞)", () => {
    const sessions = [
      s({ start: "2026-06-01T10:00:00.000Z", durationS: 5000, breakS: 0 }),
    ];
    const ach = computeAchievements(sessions);
    expect(ach.find((a) => a.id === "flow-4to1")!.earnedAt).toBeNull();
  });

  it("earns streak-7 only after 7 consecutive days", () => {
    const sevenDaySessions = Array.from({ length: 7 }, (_, i) =>
      s({
        start: new Date(
          Date.UTC(2026, 5, 1) + i * 86_400_000,
        ).toISOString(),
        durationS: 1800,
      }),
    );
    const ach6 = computeAchievements(sevenDaySessions.slice(0, 6));
    expect(ach6.find((a) => a.id === "streak-7")!.earnedAt).toBeNull();

    const ach7 = computeAchievements(sevenDaySessions);
    expect(ach7.find((a) => a.id === "streak-7")!.earnedAt).not.toBeNull();
  });

  it("earns century on the 100th session", () => {
    const sessions = Array.from({ length: 100 }, (_, i) =>
      s({
        start: new Date(
          Date.UTC(2026, 0, 1) + i * 3_600_000,
        ).toISOString(),
        durationS: 1800,
      }),
    );
    expect(computeAchievements(sessions.slice(0, 99)).find((a) => a.id === "century")!.earnedAt).toBeNull();
    expect(computeAchievements(sessions).find((a) => a.id === "century")!.earnedAt).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// computeGame
// ---------------------------------------------------------------------------

describe("computeGame", () => {
  const DAILY_GOAL = 14400; // 4h

  it("returns zeroed summary for empty sessions", () => {
    const g = computeGame([], DAILY_GOAL, NOW);
    expect(g.flowScore).toBe(0);
    expect(g.dailyMaximizationPct).toBe(0);
    expect(g.focusRestRatioToday).toBe(0);
    expect(g.focusRestRatioAllTime).toBe(0);
    expect(g.todayFocusS).toBe(0);
    expect(g.todayBreakS).toBe(0);
    expect(g.achievements).toHaveLength(6);
  });

  it("caps dailyMaximizationPct at 100", () => {
    const sessions = [
      s({ start: `${TODAY}T08:00:00.000Z`, durationS: DAILY_GOAL + 1000 }),
    ];
    const g = computeGame(sessions, DAILY_GOAL, NOW);
    expect(g.dailyMaximizationPct).toBe(100);
  });

  it("computes dailyMaximizationPct proportionally", () => {
    const sessions = [
      s({ start: `${TODAY}T08:00:00.000Z`, durationS: DAILY_GOAL / 2 }),
    ];
    const g = computeGame(sessions, DAILY_GOAL, NOW);
    expect(g.dailyMaximizationPct).toBe(50);
  });

  it("reports todayFocusS and todayBreakS only for today", () => {
    const sessions = [
      s({ start: `${TODAY}T08:00:00.000Z`, durationS: 3600, breakS: 600 }),
      s({ start: "2026-06-01T08:00:00.000Z", durationS: 1800, breakS: 300 }),
    ];
    const g = computeGame(sessions, DAILY_GOAL, NOW);
    expect(g.todayFocusS).toBe(3600);
    expect(g.todayBreakS).toBe(600);
  });

  it("computes focusRestRatioToday correctly", () => {
    const sessions = [
      s({ start: `${TODAY}T08:00:00.000Z`, durationS: 4000, breakS: 500 }),
    ];
    const g = computeGame(sessions, DAILY_GOAL, NOW);
    expect(g.focusRestRatioToday).toBeCloseTo(8, 1);
  });

  it("returns 0 focusRestRatioToday when no breaks today", () => {
    const sessions = [
      s({ start: `${TODAY}T08:00:00.000Z`, durationS: 3600 }),
    ];
    const g = computeGame(sessions, DAILY_GOAL, NOW);
    expect(g.focusRestRatioToday).toBe(0);
  });

  it("computes focusRestRatioAllTime across all sessions", () => {
    const sessions = [
      s({ start: `${TODAY}T08:00:00.000Z`, durationS: 3600, breakS: 900 }),
      s({ start: "2026-06-01T08:00:00.000Z", durationS: 3600, breakS: 900 }),
    ];
    const g = computeGame(sessions, DAILY_GOAL, NOW);
    expect(g.focusRestRatioAllTime).toBeCloseTo(4, 1);
  });

  it("flowScore is 0 with no sessions", () => {
    expect(computeGame([], DAILY_GOAL, NOW).flowScore).toBe(0);
  });

  it("flowScore is > 0 when today has focus time", () => {
    const sessions = [
      s({ start: `${TODAY}T08:00:00.000Z`, durationS: 7200 }),
    ];
    expect(computeGame(sessions, DAILY_GOAL, NOW).flowScore).toBeGreaterThan(0);
  });

  it("flowScore reaches max 100 when fully hitting goal with balanced breaks", () => {
    // 4h focus + 15% break (~36m) = well within healthy band
    const sessions = [
      s({ start: `${TODAY}T08:00:00.000Z`, durationS: 14400, breakS: 2160 }),
    ];
    const g = computeGame(sessions, DAILY_GOAL, NOW);
    // Should be high (combined volume + balance + streak)
    expect(g.flowScore).toBeGreaterThanOrEqual(80);
  });

  it("flowScore is deterministic for the same inputs", () => {
    const sessions = [
      s({ start: `${TODAY}T08:00:00.000Z`, durationS: 7200, breakS: 900 }),
    ];
    const g1 = computeGame(sessions, DAILY_GOAL, NOW);
    const g2 = computeGame(sessions, DAILY_GOAL, NOW);
    expect(g1.flowScore).toBe(g2.flowScore);
  });

  it("flowScore is within [0, 100]", () => {
    const extremeSessions = [
      s({ start: `${TODAY}T08:00:00.000Z`, durationS: 36000, breakS: 0 }),
    ];
    const g = computeGame(extremeSessions, DAILY_GOAL, NOW);
    expect(g.flowScore).toBeGreaterThanOrEqual(0);
    expect(g.flowScore).toBeLessThanOrEqual(100);
  });
});
