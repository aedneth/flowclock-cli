/**
 * Shared aggregator that composes stats, gamification, goals, and recent
 * sessions into a single snapshot object.
 *
 * Intended consumers: dashboard command (Stage D), MCP tools (Stage F), and
 * any future surface that needs a one-shot view of the user's state.
 *
 * Pure — no I/O. The caller is responsible for loading sessions and config.
 */

import type { Session } from "../schemas/session.js";
import { computeStats, type StatsSummary } from "./stats.js";
import { computeGame, type GameSummary } from "./game.js";
import { summarizeGoals, type GoalSummary } from "../commands/goals.js";
import { querySessions } from "./session.js";

export interface DashboardSnapshot {
  /** ISO timestamp when this snapshot was generated. */
  generatedAt: string;
  stats: StatsSummary;
  game: GameSummary;
  goals: GoalSummary[];
  /** Up to 20 most-recent sessions (newest first). */
  recent: Session[];
}

/**
 * Build a complete dashboard snapshot from a flat session list.
 *
 * @param sessions - All sessions (raw, not pre-filtered).
 * @param dailyFocusGoalS - Daily focus goal in seconds (from config).
 * @param now - Injectable clock; defaults to `new Date()`.
 */
export function buildSnapshot(
  sessions: Session[],
  dailyFocusGoalS: number,
  now: Date = new Date(),
): DashboardSnapshot {
  return {
    generatedAt: now.toISOString(),
    stats: computeStats(sessions, now),
    game: computeGame(sessions, dailyFocusGoalS, now),
    goals: summarizeGoals(sessions),
    recent: querySessions(sessions, { limit: 20 }),
  };
}
