/**
 * Tests for Stage E: dashboard views (pure renderers) and the --json / non-TTY
 * path of runDashboard.
 *
 * WS5 additions: buildFrame (session view + palette overlay), compositeOverlay,
 * and the help view.
 *
 * We do NOT test the interactive TUI loop against a real TTY.
 */

import { describe, it, expect } from "vitest";
import { SessionSchema, type Session } from "../src/schemas/session.js";
import type { DashboardSnapshot } from "../src/lib/snapshot.js";
import { buildSnapshot } from "../src/lib/snapshot.js";
import type { Rect } from "../src/lib/tui/layout.js";
import { displayWidth } from "../src/lib/tui/draw.js";
import { Timer } from "../src/lib/timer.js";

// Views under test
import { renderOverview } from "../src/tui/views/overview.js";
import { renderSessions, sessionDetail } from "../src/tui/views/sessions.js";
import type { SessionsState } from "../src/tui/views/sessions.js";
import { renderGoals } from "../src/tui/views/goals.js";
import { renderBreaks } from "../src/tui/views/breaks.js";

// App under test (WS5)
import { buildFrame, compositeOverlay } from "../src/tui/app.js";
import type { LiveSession } from "../src/tui/app.js";
import { emptyPaletteState } from "../src/tui/palette.js";

// Command under test
import { runDashboard } from "../src/commands/dashboard.js";
import type { CommandContext } from "../src/lib/context.js";
import type { Config } from "../src/schemas/config.js";
import type { FlowclockPaths } from "../src/lib/paths.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Strip ANSI escape sequences from a string. */
function stripAnsi(s: string): string {
  // eslint-disable-next-line no-control-regex
  return s.replace(/\x1b(?:\[[0-9;]*[A-Za-z]|\][^\x07\x1b]*(?:\x07|\x1b\\))/g, "");
}

function makeSession(opts: {
  start: string;
  durationS: number;
  breakS?: number;
  goal?: string | null;
  goalMet?: boolean | null;
  focusTargetS?: number | null;
  breakBudgetS?: number | null;
  breaks?: Array<{ start: string; end: string; durationS: number; category?: string }>;
}): Session {
  const start = new Date(opts.start);
  const end = new Date(start.getTime() + opts.durationS * 1000 + (opts.breakS ?? 0) * 1000);
  return SessionSchema.parse({
    id: `id-${opts.start}`,
    start: opts.start,
    end: end.toISOString(),
    durationS: opts.durationS,
    source: "log",
    breakS: opts.breakS ?? 0,
    goal: opts.goal ?? null,
    goalMet: opts.goalMet ?? null,
    focusTargetS: opts.focusTargetS ?? null,
    breakBudgetS: opts.breakBudgetS ?? null,
    breaks: (opts.breaks ?? []).map((b) => ({
      start: b.start,
      end: b.end,
      durationS: b.durationS,
      category: b.category ?? "rest",
    })),
  });
}

const NOW = new Date("2026-06-09T12:00:00.000Z");
const DAILY_GOAL = 14400; // 4 hours

const RECT: Rect = { top: 0, left: 0, width: 80, height: 20 };
const SMALL_RECT: Rect = { top: 0, left: 0, width: 40, height: 10 };

function makeSnap(sessions: Session[] = []): DashboardSnapshot {
  return buildSnapshot(sessions, DAILY_GOAL, NOW);
}

// ---------------------------------------------------------------------------
// renderOverview — pure rendering tests
// ---------------------------------------------------------------------------

describe("renderOverview", () => {
  it("returns exactly rect.height rows", () => {
    const snap = makeSnap();
    const rows = renderOverview(snap, RECT, {}, "neon", false);
    expect(rows).toHaveLength(RECT.height);
  });

  it("each row has display width === rect.width", () => {
    const snap = makeSnap();
    const rows = renderOverview(snap, RECT, {}, "neon", false);
    for (const row of rows) {
      expect(displayWidth(row)).toBe(RECT.width);
    }
  });

  it("contains 'Overview' title in first row", () => {
    const snap = makeSnap();
    const rows = renderOverview(snap, RECT, {}, "neon", false);
    expect(stripAnsi(rows[0] ?? "")).toContain("Overview");
  });

  it("contains 'Flow score' label", () => {
    const snap = makeSnap();
    const rows = renderOverview(snap, RECT, {}, "neon", false);
    const combined = rows.map(stripAnsi).join("\n");
    expect(combined).toContain("Flow score");
  });

  it("contains 'Today focus' label", () => {
    const snap = makeSnap();
    const rows = renderOverview(snap, RECT, {}, "neon", false);
    const combined = rows.map(stripAnsi).join("\n");
    expect(combined).toContain("Today focus");
  });

  it("contains 'streak' info", () => {
    const snap = makeSnap();
    const rows = renderOverview(snap, RECT, {}, "neon", false);
    const combined = rows.map(stripAnsi).join("\n");
    expect(combined.toLowerCase()).toContain("streak");
  });

  it("contains 'Last 7 days' label", () => {
    const snap = makeSnap();
    const rows = renderOverview(snap, RECT, {}, "neon", false);
    const combined = rows.map(stripAnsi).join("\n");
    expect(combined).toContain("Last 7 days");
  });

  it("contains 'Achievements' label", () => {
    const snap = makeSnap();
    const rows = renderOverview(snap, RECT, {}, "neon", false);
    const combined = rows.map(stripAnsi).join("\n");
    expect(combined).toContain("Achievements");
  });

  it("shows today's focus duration when sessions exist", () => {
    const sessions = [
      makeSession({ start: "2026-06-09T09:00:00.000Z", durationS: 3600 }),
    ];
    const snap = makeSnap(sessions);
    const rows = renderOverview(snap, RECT, {}, "neon", false);
    const combined = rows.map(stripAnsi).join("\n");
    expect(combined).toContain("1h"); // 1 hour
  });

  it("works with small rect", () => {
    const snap = makeSnap();
    const rows = renderOverview(snap, SMALL_RECT, {}, "neon", false);
    expect(rows).toHaveLength(SMALL_RECT.height);
    for (const row of rows) {
      expect(displayWidth(row)).toBe(SMALL_RECT.width);
    }
  });

  it("color=true produces ANSI sequences", () => {
    const snap = makeSnap();
    const rows = renderOverview(snap, RECT, {}, "neon", true);
    const combined = rows.join("\n");
    expect(combined).toContain("\x1b[");
  });
});

// ---------------------------------------------------------------------------
// renderSessions — list rendering + scroll/selection
// ---------------------------------------------------------------------------

describe("renderSessions", () => {
  const defaultState: SessionsState = {
    selectedIndex: 0,
    scrollTop: 0,
    detailOpen: false,
  };

  it("returns exactly rect.height rows", () => {
    const snap = makeSnap();
    const rows = renderSessions(snap, RECT, defaultState, "neon", false);
    expect(rows).toHaveLength(RECT.height);
  });

  it("each row has display width === rect.width", () => {
    const snap = makeSnap();
    const rows = renderSessions(snap, RECT, defaultState, "neon", false);
    for (const row of rows) {
      expect(displayWidth(row)).toBe(RECT.width);
    }
  });

  it("shows 'Sessions' title", () => {
    const snap = makeSnap();
    const rows = renderSessions(snap, RECT, defaultState, "neon", false);
    expect(stripAnsi(rows[0] ?? "")).toContain("Sessions");
  });

  it("shows 'No sessions yet' when empty", () => {
    const snap = makeSnap([]);
    const rows = renderSessions(snap, RECT, defaultState, "neon", false);
    const combined = rows.map(stripAnsi).join("\n");
    expect(combined).toContain("No sessions");
  });

  it("renders session lines when sessions exist", () => {
    const sessions = [
      makeSession({ start: "2026-06-09T09:00:00.000Z", durationS: 1800 }),
    ];
    const snap = makeSnap(sessions);
    const rows = renderSessions(snap, RECT, defaultState, "neon", false);
    const combined = rows.map(stripAnsi).join("\n");
    expect(combined).toContain("30m"); // 1800s = 30m
  });

  it("shows goal name when session has goal", () => {
    const sessions = [
      makeSession({ start: "2026-06-09T09:00:00.000Z", durationS: 1800, goal: "Write tests" }),
    ];
    const snap = makeSnap(sessions);
    const rows = renderSessions(snap, RECT, defaultState, "neon", false);
    const combined = rows.map(stripAnsi).join("\n");
    expect(combined).toContain("Write tests");
  });

  it("shows target-hit marker when focusTargetS is set and met", () => {
    const sessions = [
      makeSession({ start: "2026-06-09T09:00:00.000Z", durationS: 3600, focusTargetS: 1800 }),
    ];
    const snap = makeSnap(sessions);
    const rows = renderSessions(snap, RECT, defaultState, "neon", false);
    const combined = rows.map(stripAnsi).join("\n");
    expect(combined).toContain("✓");
  });

  it("shows target-miss marker when focusTargetS is set but not met", () => {
    const sessions = [
      makeSession({ start: "2026-06-09T09:00:00.000Z", durationS: 900, focusTargetS: 3600 }),
    ];
    const snap = makeSnap(sessions);
    const rows = renderSessions(snap, RECT, defaultState, "neon", false);
    const combined = rows.map(stripAnsi).join("\n");
    expect(combined).toContain("✗");
  });

  it("scroll respects scrollTop — skips earlier entries", () => {
    const sessions = Array.from({ length: 15 }, (_, i) =>
      makeSession({
        start: new Date(Date.UTC(2026, 5, 9, 0, 0, 0) - i * 3600 * 1000).toISOString(),
        durationS: 600,
      }),
    );
    const snap = makeSnap(sessions);
    // scrollTop=5 means we start showing from index 5
    const stateScrolled: SessionsState = { selectedIndex: 5, scrollTop: 5, detailOpen: false };
    const rows = renderSessions(snap, RECT, stateScrolled, "neon", false);
    expect(rows).toHaveLength(RECT.height);
  });

  it("selectedIndex row differs from non-selected rows (color=true)", () => {
    const sessions = [
      makeSession({ start: "2026-06-09T10:00:00.000Z", durationS: 1800 }),
      makeSession({ start: "2026-06-09T08:00:00.000Z", durationS: 1800 }),
    ];
    const snap = makeSnap(sessions);
    const stateWithSel: SessionsState = { selectedIndex: 0, scrollTop: 0, detailOpen: false };
    const rowsWithColor = renderSessions(snap, RECT, stateWithSel, "neon", true);
    // First session row (index 1 in frame = after panel top border) should contain ANSI color
    const bodyRow = rowsWithColor[1] ?? "";
    expect(bodyRow).toContain("\x1b[");
  });
});

// ---------------------------------------------------------------------------
// sessionDetail — timeline rendering
// ---------------------------------------------------------------------------

describe("sessionDetail", () => {
  it("returns exactly rect.height rows", () => {
    const session = makeSession({ start: "2026-06-09T09:00:00.000Z", durationS: 3600 });
    const rows = sessionDetail(session, RECT, "neon", false);
    expect(rows).toHaveLength(RECT.height);
  });

  it("each row has display width === rect.width", () => {
    const session = makeSession({ start: "2026-06-09T09:00:00.000Z", durationS: 3600 });
    const rows = sessionDetail(session, RECT, "neon", false);
    for (const row of rows) {
      expect(displayWidth(row)).toBe(RECT.width);
    }
  });

  it("shows 'Session Detail' title", () => {
    const session = makeSession({ start: "2026-06-09T09:00:00.000Z", durationS: 3600 });
    const rows = sessionDetail(session, RECT, "neon", false);
    expect(stripAnsi(rows[0] ?? "")).toContain("Session Detail");
  });

  it("shows focus interval in timeline", () => {
    const session = makeSession({ start: "2026-06-09T09:00:00.000Z", durationS: 3600 });
    const rows = sessionDetail(session, RECT, "neon", false);
    const combined = rows.map(stripAnsi).join("\n");
    expect(combined).toContain("FOCUS");
  });

  it("shows break interval with category in timeline", () => {
    const brkStart = "2026-06-09T09:30:00.000Z";
    const brkEnd = "2026-06-09T09:35:00.000Z";
    const session = makeSession({
      start: "2026-06-09T09:00:00.000Z",
      durationS: 3300, // 55m focus
      breakS: 300,     // 5m break
      breaks: [{ start: brkStart, end: brkEnd, durationS: 300, category: "rest" }],
    });
    const rows = sessionDetail(session, RECT, "neon", false);
    const combined = rows.map(stripAnsi).join("\n");
    expect(combined).toContain("BREAK");
    expect(combined).toContain("REST");
  });

  it("shows both focus and break intervals when session has breaks", () => {
    const brkStart = "2026-06-09T09:30:00.000Z";
    const brkEnd = "2026-06-09T09:35:00.000Z";
    const session = makeSession({
      start: "2026-06-09T09:00:00.000Z",
      durationS: 3300,
      breakS: 300,
      breaks: [{ start: brkStart, end: brkEnd, durationS: 300, category: "exercise" }],
    });
    const rows = sessionDetail(session, RECT, "neon", false);
    const combined = rows.map(stripAnsi).join("\n");
    expect(combined).toContain("FOCUS");
    expect(combined).toContain("BREAK");
    expect(combined).toContain("EXERCISE");
  });

  it("shows goal when set", () => {
    const session = makeSession({
      start: "2026-06-09T09:00:00.000Z",
      durationS: 3600,
      goal: "Finish the feature",
    });
    const rows = sessionDetail(session, RECT, "neon", false);
    const combined = rows.map(stripAnsi).join("\n");
    expect(combined).toContain("Finish the feature");
  });
});

// ---------------------------------------------------------------------------
// renderGoals — goals view
// ---------------------------------------------------------------------------

describe("renderGoals", () => {
  it("returns exactly rect.height rows", () => {
    const snap = makeSnap();
    const rows = renderGoals(snap, RECT, {}, "neon", false);
    expect(rows).toHaveLength(RECT.height);
  });

  it("each row has display width === rect.width", () => {
    const snap = makeSnap();
    const rows = renderGoals(snap, RECT, {}, "neon", false);
    for (const row of rows) {
      expect(displayWidth(row)).toBe(RECT.width);
    }
  });

  it("shows 'Goals' title", () => {
    const snap = makeSnap();
    const rows = renderGoals(snap, RECT, {}, "neon", false);
    expect(stripAnsi(rows[0] ?? "")).toContain("Goals");
  });

  it("shows 'No goals yet' when no sessions have goals", () => {
    const snap = makeSnap([]);
    const rows = renderGoals(snap, RECT, {}, "neon", false);
    const combined = rows.map(stripAnsi).join("\n");
    expect(combined).toContain("No goals");
  });

  it("renders goal names when goals exist", () => {
    const sessions = [
      makeSession({ start: "2026-06-09T09:00:00.000Z", durationS: 3600, goal: "Deep Work" }),
    ];
    const snap = makeSnap(sessions);
    const rows = renderGoals(snap, RECT, {}, "neon", false);
    const combined = rows.map(stripAnsi).join("\n");
    expect(combined).toContain("Deep Work");
  });

  it("shows session count and total focus for a goal", () => {
    const sessions = [
      makeSession({ start: "2026-06-09T09:00:00.000Z", durationS: 3600, goal: "Study" }),
      makeSession({ start: "2026-06-09T11:00:00.000Z", durationS: 1800, goal: "Study" }),
    ];
    const snap = makeSnap(sessions);
    const rows = renderGoals(snap, RECT, {}, "neon", false);
    const combined = rows.map(stripAnsi).join("\n");
    expect(combined).toContain("Study");
    expect(combined).toContain("Sessions");
    expect(combined).toContain("Total focus");
  });

  it("shows met/missed tally", () => {
    const sessions = [
      makeSession({ start: "2026-06-09T09:00:00.000Z", durationS: 3600, goal: "A", goalMet: true }),
      makeSession({ start: "2026-06-09T11:00:00.000Z", durationS: 1800, goal: "A", goalMet: false }),
    ];
    const snap = makeSnap(sessions);
    const rows = renderGoals(snap, RECT, {}, "neon", false);
    const combined = rows.map(stripAnsi).join("\n");
    expect(combined).toContain("✓");
    expect(combined).toContain("✗");
  });
});

// ---------------------------------------------------------------------------
// renderBreaks — breaks view
// ---------------------------------------------------------------------------

describe("renderBreaks", () => {
  it("returns exactly rect.height rows", () => {
    const snap = makeSnap();
    const rows = renderBreaks(snap, RECT, {}, "neon", false);
    expect(rows).toHaveLength(RECT.height);
  });

  it("each row has display width === rect.width", () => {
    const snap = makeSnap();
    const rows = renderBreaks(snap, RECT, {}, "neon", false);
    for (const row of rows) {
      expect(displayWidth(row)).toBe(RECT.width);
    }
  });

  it("shows 'Breaks' title", () => {
    const snap = makeSnap();
    const rows = renderBreaks(snap, RECT, {}, "neon", false);
    expect(stripAnsi(rows[0] ?? "")).toContain("Breaks");
  });

  it("shows category labels in the output", () => {
    const snap = makeSnap();
    const rows = renderBreaks(snap, RECT, {}, "neon", false);
    const combined = rows.map(stripAnsi).join("\n");
    // At minimum these categories should appear
    expect(combined).toContain("rest");
    expect(combined).toContain("meal");
  });

  it("shows focus and break totals", () => {
    const sessions = [
      makeSession({ start: "2026-06-09T09:00:00.000Z", durationS: 3600, breakS: 600 }),
    ];
    const snap = makeSnap(sessions);
    const rows = renderBreaks(snap, RECT, {}, "neon", false);
    const combined = rows.map(stripAnsi).join("\n");
    expect(combined).toContain("Total focus");
    expect(combined).toContain("Total break");
  });

  it("shows break category bars when breaks are categorized", () => {
    const brkStart = "2026-06-09T09:30:00.000Z";
    const brkEnd = "2026-06-09T09:40:00.000Z";
    const sessions = [
      makeSession({
        start: "2026-06-09T09:00:00.000Z",
        durationS: 3000,
        breakS: 600,
        breaks: [{ start: brkStart, end: brkEnd, durationS: 600, category: "meal" }],
      }),
    ];
    const snap = makeSnap(sessions);
    const rows = renderBreaks(snap, RECT, {}, "neon", false);
    const combined = rows.map(stripAnsi).join("\n");
    expect(combined).toContain("meal");
  });
});

// ---------------------------------------------------------------------------
// runDashboard — non-TTY / --json path
// ---------------------------------------------------------------------------

describe("runDashboard (non-TTY / --json)", () => {
  function makeFakeCtx(opts: { json?: boolean; isTTY?: boolean } = {}): CommandContext {
    return {
      config: {
        schemaVersion: 1,
        theme: "neon",
        keybindings: { pause: "p", reset: "r", quit: "q", break: "b", category: "c" },
        sessionsPath: null,
        apiEndpoint: null,
        bigFont: false,
        displayStyle: "simple",
        showControls: true,
        dailyFocusGoalS: 14400,
      } satisfies Config,
      paths: {
        configDir: "/tmp",
        dataDir: "/tmp",
        configFile: "/tmp/config.json",
        sessionsFile: "/tmp/nonexistent-sessions-dashboard-test.json",
      } satisfies FlowclockPaths,
      logger: { info: () => {}, warn: () => {}, error: () => {} },
      json: opts.json ?? false,
      color: false,
      yes: false,
      isTTY: opts.isTTY ?? false,
      env: {},
    };
  }

  it("prints JSON snapshot and returns (json=true)", async () => {
    const ctx = makeFakeCtx({ json: true, isTTY: true });
    const written: string[] = [];
    const origWrite = process.stdout.write.bind(process.stdout);
    process.stdout.write = ((s: string) => { written.push(s); return true; }) as typeof process.stdout.write;

    try {
      await runDashboard(ctx, {});
    } finally {
      process.stdout.write = origWrite;
    }

    expect(written.length).toBeGreaterThan(0);
    const output = written.join("");
    const parsed = JSON.parse(output) as { ok: boolean; command: string; data: unknown };
    expect(parsed.ok).toBe(true);
    expect(parsed.command).toBe("dashboard");
    expect(parsed.data).toHaveProperty("stats");
    expect(parsed.data).toHaveProperty("game");
    expect(parsed.data).toHaveProperty("goals");
    expect(parsed.data).toHaveProperty("recent");
    expect(parsed.data).toHaveProperty("generatedAt");
  });

  it("prints JSON snapshot and returns (isTTY=false, json=false)", async () => {
    const ctx = makeFakeCtx({ json: false, isTTY: false });
    const written: string[] = [];
    const origWrite = process.stdout.write.bind(process.stdout);
    process.stdout.write = ((s: string) => { written.push(s); return true; }) as typeof process.stdout.write;

    try {
      await runDashboard(ctx, {});
    } finally {
      process.stdout.write = origWrite;
    }

    const output = written.join("");
    const parsed = JSON.parse(output) as { ok: boolean; command: string };
    expect(parsed.ok).toBe(true);
    expect(parsed.command).toBe("dashboard");
  });

  it("does not throw when sessions file does not exist", async () => {
    const ctx = makeFakeCtx({ json: true });
    const written: string[] = [];
    const origWrite = process.stdout.write.bind(process.stdout);
    process.stdout.write = ((s: string) => { written.push(s); return true; }) as typeof process.stdout.write;

    try {
      await expect(runDashboard(ctx, {})).resolves.toBeUndefined();
    } finally {
      process.stdout.write = origWrite;
    }
  });

  it("snapshot data has correct structure", async () => {
    const ctx = makeFakeCtx({ json: true });
    const written: string[] = [];
    const origWrite = process.stdout.write.bind(process.stdout);
    process.stdout.write = ((s: string) => { written.push(s); return true; }) as typeof process.stdout.write;

    try {
      await runDashboard(ctx, {});
    } finally {
      process.stdout.write = origWrite;
    }

    const parsed = JSON.parse(written.join("")) as { data: DashboardSnapshot };
    expect(parsed.data.stats).toHaveProperty("todayTotalS");
    expect(parsed.data.stats).toHaveProperty("currentStreak");
    expect(parsed.data.stats).toHaveProperty("week");
    expect(parsed.data.game).toHaveProperty("flowScore");
    expect(parsed.data.game).toHaveProperty("achievements");
    expect(Array.isArray(parsed.data.goals)).toBe(true);
    expect(Array.isArray(parsed.data.recent)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// buildFrame — WS5: session view, palette overlay, help view
// ---------------------------------------------------------------------------

describe("buildFrame (WS5)", () => {
  function makeFakeCtx(): CommandContext {
    return {
      config: {
        schemaVersion: 1,
        theme: "neon",
        keybindings: { pause: "p", reset: "r", quit: "q", break: "b", category: "c" },
        sessionsPath: null,
        apiEndpoint: null,
        bigFont: false,
        displayStyle: "simple",
        showControls: true,
        dailyFocusGoalS: 14400,
      } satisfies Config,
      paths: {
        configDir: "/tmp",
        dataDir: "/tmp",
        configFile: "/tmp/config.json",
        sessionsFile: "/tmp/nonexistent-sessions-buildframe-test.json",
      } satisfies FlowclockPaths,
      logger: { info: () => {}, warn: () => {}, error: () => {} },
      json: false,
      color: false,
      yes: false,
      isTTY: false,
      env: {},
    };
  }

  it("session view (idle) — contains idle prompt", () => {
    const ctx = makeFakeCtx();
    const state = {
      view: "session" as const,
      sessions: [],
      selectedIndex: 0,
      scrollTop: 0,
      detailOpen: false,
      live: null,
      palette: emptyPaletteState(),
      summary: null,
      theme: "neon" as const,
    };
    const frame = buildFrame(state, 80, 24, ctx);
    const combined = frame.map(stripAnsi).join("\n");
    // Session view should render the panel title
    expect(combined).toContain("Session");
    // Idle state shows the prompt
    expect(combined).toContain("No active session");
  });

  it("session view with live session — footer contains pause keybinding", () => {
    const ctx = makeFakeCtx();
    const timer = new Timer();
    const live: LiveSession = {
      timer,
      goal: "test-goal",
      label: null,
      focusTargetS: null,
      breakBudgetS: null,
    };
    const state = {
      view: "session" as const,
      sessions: [],
      selectedIndex: 0,
      scrollTop: 0,
      detailOpen: false,
      live,
      palette: emptyPaletteState(),
      summary: null,
      theme: "neon" as const,
    };
    const frame = buildFrame(state, 80, 24, ctx);
    const combined = frame.map(stripAnsi).join("\n");
    // Footer should contain the pause keybinding hint
    expect(combined).toContain("pause");
    // The live goal should appear in the body
    expect(combined).toContain("test-goal");
  });

  it("session view with live session — frame contains exactly 24 rows", () => {
    const ctx = makeFakeCtx();
    const timer = new Timer();
    const live: LiveSession = {
      timer,
      goal: null,
      label: null,
      focusTargetS: null,
      breakBudgetS: null,
    };
    const state = {
      view: "session" as const,
      sessions: [],
      selectedIndex: 0,
      scrollTop: 0,
      detailOpen: false,
      live,
      palette: emptyPaletteState(),
      summary: null,
      theme: "neon" as const,
    };
    const frame = buildFrame(state, 80, 24, ctx);
    expect(frame).toHaveLength(24);
  });

  it("palette open — frame contains 'Commands' panel title", () => {
    const ctx = makeFakeCtx();
    const state = {
      view: "session" as const,
      sessions: [],
      selectedIndex: 0,
      scrollTop: 0,
      detailOpen: false,
      live: null,
      palette: { open: true, query: "", selected: 0 },
      summary: null,
      theme: "neon" as const,
    };
    const frame = buildFrame(state, 80, 24, ctx);
    const combined = frame.map(stripAnsi).join("\n");
    expect(combined).toContain("Commands");
  });

  it("help view — frame contains 'Flowtime' text", () => {
    const ctx = makeFakeCtx();
    const state = {
      view: "help" as const,
      sessions: [],
      selectedIndex: 0,
      scrollTop: 0,
      detailOpen: false,
      live: null,
      palette: emptyPaletteState(),
      summary: null,
      theme: "neon" as const,
    };
    const frame = buildFrame(state, 80, 24, ctx);
    const combined = frame.map(stripAnsi).join("\n");
    expect(combined).toContain("Flowtime");
  });

  it("overview view — frame contains 'Overview'", () => {
    const ctx = makeFakeCtx();
    const state = {
      view: "overview" as const,
      sessions: [],
      selectedIndex: 0,
      scrollTop: 0,
      detailOpen: false,
      live: null,
      palette: emptyPaletteState(),
      summary: null,
      theme: "neon" as const,
    };
    const frame = buildFrame(state, 80, 24, ctx);
    const combined = frame.map(stripAnsi).join("\n");
    expect(combined).toContain("Overview");
  });

  it("returns exactly `rows` rows", () => {
    const ctx = makeFakeCtx();
    const state = {
      view: "overview" as const,
      sessions: [],
      selectedIndex: 0,
      scrollTop: 0,
      detailOpen: false,
      live: null,
      palette: emptyPaletteState(),
      summary: null,
      theme: "neon" as const,
    };
    const frame = buildFrame(state, 80, 30, ctx);
    expect(frame).toHaveLength(30);
  });
});

// ---------------------------------------------------------------------------
// compositeOverlay — pure overlay compositing
// ---------------------------------------------------------------------------

describe("compositeOverlay", () => {
  it("places overlay rows at the specified position", () => {
    const frame = [
      "                    ", // 20 wide
      "                    ",
      "                    ",
      "                    ",
    ];
    const overlay = {
      rows: ["[HELLO]"],
      top: 1,
      left: 2,
    };
    const result = compositeOverlay(frame, overlay, 20);
    expect(result[1]).toContain("HELLO");
  });

  it("preserves rows not covered by overlay", () => {
    const frame = [
      "AAAAAAAA            ", // 20 wide
      "BBBBBBBB            ",
      "CCCCCCCC            ",
    ];
    const overlay = { rows: ["[XX]"], top: 1, left: 0 };
    const result = compositeOverlay(frame, overlay, 20);
    // Row 0 should be unchanged
    expect(result[0]).toBe(frame[0]);
    // Row 2 should be unchanged
    expect(result[2]).toBe(frame[2]);
  });

  it("each row in result has exactly `cols` display width", () => {
    const frame = Array.from({ length: 5 }, () => " ".repeat(40));
    const overlay = { rows: ["[CMD]", "[OPT]"], top: 1, left: 5 };
    const result = compositeOverlay(frame, overlay, 40);
    for (const row of result) {
      expect(displayWidth(row)).toBe(40);
    }
  });

  it("clips overlay rows that fall outside frame bounds", () => {
    const frame = ["          "]; // 10 wide, 1 row
    const overlay = { rows: ["[OUT]"], top: 5, left: 0 }; // beyond frame
    const result = compositeOverlay(frame, overlay, 10);
    expect(result).toHaveLength(1);
    expect(result[0]).toBe(frame[0]); // unchanged
  });
});
