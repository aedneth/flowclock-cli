import type { CommandContext } from "../lib/context.js";
import { readSessions } from "../lib/session.js";
import { sessionsPathFor } from "../lib/config.js";
import { humanDuration } from "../lib/format.js";
import { jsonSuccess, printJson } from "../lib/output.js";
import type { Session } from "../schemas/session.js";

/** One goal, learned from the sessions that named it. */
export interface GoalSummary {
  goal: string;
  count: number;
  totalS: number;
  met: number;
  missed: number;
  neutral: number;
  lastUsed: string; // ISO start of the most recent session with this goal
}

/** Aggregate sessions into per-goal summaries, most recently used first. */
export function summarizeGoals(sessions: Session[]): GoalSummary[] {
  const byGoal = new Map<string, GoalSummary>();
  for (const s of sessions) {
    if (!s.goal) continue;
    const g = byGoal.get(s.goal) ?? {
      goal: s.goal,
      count: 0,
      totalS: 0,
      met: 0,
      missed: 0,
      neutral: 0,
      lastUsed: s.start,
    };
    g.count += 1;
    g.totalS += s.durationS;
    if (s.goalMet === true) g.met += 1;
    else if (s.goalMet === false) g.missed += 1;
    else g.neutral += 1;
    if (new Date(s.start).getTime() > new Date(g.lastUsed).getTime()) {
      g.lastUsed = s.start;
    }
    byGoal.set(s.goal, g);
  }
  return [...byGoal.values()].sort(
    (a, b) => new Date(b.lastUsed).getTime() - new Date(a.lastUsed).getTime(),
  );
}

/** `flowclock goals` — your goals, learned from your logged sessions. */
export function runGoals(ctx: CommandContext): void {
  const file = sessionsPathFor(ctx.config, ctx.paths);
  const { sessions } = readSessions(file);
  const goals = summarizeGoals(sessions);

  if (ctx.json) {
    printJson(jsonSuccess("goals", { count: goals.length, goals }));
    return;
  }

  if (goals.length === 0) {
    process.stdout.write(
      "No goals yet. Start one with: flowclock start --goal \"...\"\n",
    );
    return;
  }

  const lines = goals.map((g) => {
    const total = humanDuration(g.totalS).padStart(12);
    const tally = `${g.met}✓ ${g.missed}✗ ${g.neutral}·`;
    return `${total}  ${String(g.count).padStart(3)}×  ${tally.padEnd(12)}  ${g.goal}`;
  });
  process.stdout.write(lines.join("\n") + "\n");
}
