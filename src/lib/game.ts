/**
 * Pure gamification module — achievements, flow score, daily maximization.
 *
 * All exports are deterministic and side-effect-free; `now` is injectable for
 * tests. No I/O is performed here.
 */

import type { Session } from "../schemas/session.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Achievement {
  id: string;
  label: string;
  description: string;
  /** ISO timestamp when earned (earliest qualifying event), or null. */
  earnedAt: string | null;
}

export interface GameSummary {
  /** Composite score 0–100. See computeFlowScore for formula. */
  flowScore: number;
  /** Today's focus as a percentage of the daily goal (capped at 100). */
  dailyMaximizationPct: number;
  /** Today's focus÷break ratio (0 when no breaks today). */
  focusRestRatioToday: number;
  /** All-time focus÷break ratio (0 when no breaks ever). */
  focusRestRatioAllTime: number;
  /** Today's active focus seconds. */
  todayFocusS: number;
  /** Today's break seconds. */
  todayBreakS: number;
  achievements: Achievement[];
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** YYYY-MM-DD in local time from any ISO string (mirrors stats.ts). */
function localDateKey(iso: string): string {
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Calendar-day index for a local YYYY-MM-DD key (for streak math). */
function dayNumber(key: string): number {
  const [y, m, d] = key.split("-").map(Number);
  return Math.floor(Date.UTC(y!, m! - 1, d!) / 86_400_000);
}

/** Longest run of consecutive calendar days from a sorted unique set of keys. */
function longestConsecutiveRun(sortedKeys: string[]): number {
  if (sortedKeys.length === 0) return 0;
  const nums = sortedKeys.map(dayNumber);
  let longest = 1;
  let run = 1;
  for (let i = 1; i < nums.length; i++) {
    run = nums[i]! === nums[i - 1]! + 1 ? run + 1 : 1;
    if (run > longest) longest = run;
  }
  return longest;
}

// ---------------------------------------------------------------------------
// Achievements
// ---------------------------------------------------------------------------

/**
 * Known achievement catalogue.
 *
 * The function returns the full set; earned ones have `earnedAt` set to the
 * ISO timestamp of the first qualifying event (deterministic).
 */
export function computeAchievements(
  sessions: Session[],
  _now?: Date,
): Achievement[] {
  // Sort ascending by start so "earnedAt" is the first qualifying event.
  const sorted = [...sessions].sort(
    (a, b) => new Date(a.start).getTime() - new Date(b.start).getTime(),
  );

  // --- first-hour: cumulative focus ≥ 1h (3600s) ---
  let cumulativeS = 0;
  let firstHourAt: string | null = null;
  for (const s of sorted) {
    cumulativeS += s.durationS;
    if (cumulativeS >= 3600) {
      firstHourAt = s.end;
      break;
    }
  }

  // --- deep-diver: single session focus ≥ 90m (5400s) ---
  let deepDiverAt: string | null = null;
  for (const s of sorted) {
    if (s.durationS >= 5400) {
      deepDiverAt = s.start;
      break;
    }
  }

  // --- budget-master: a session where breakBudgetS!=null and breakS <= breakBudgetS ---
  let budgetMasterAt: string | null = null;
  for (const s of sorted) {
    if (s.breakBudgetS !== null && s.breakBudgetS !== undefined && s.breakS <= s.breakBudgetS) {
      budgetMasterAt = s.start;
      break;
    }
  }

  // --- flow-4to1: any local day with focus:break ≥ 4:1 (ratio ≥ 4) and breakS > 0 ---
  // Aggregate per local day.
  const dayFocusS = new Map<string, number>();
  const dayBreakS = new Map<string, number>();
  const dayFirstStart = new Map<string, string>();
  for (const s of sorted) {
    const k = localDateKey(s.start);
    dayFocusS.set(k, (dayFocusS.get(k) ?? 0) + s.durationS);
    dayBreakS.set(k, (dayBreakS.get(k) ?? 0) + s.breakS);
    if (!dayFirstStart.has(k)) dayFirstStart.set(k, s.start);
  }
  let flow4to1At: string | null = null;
  for (const [k, fS] of dayFocusS) {
    const bS = dayBreakS.get(k) ?? 0;
    if (bS > 0 && fS / bS >= 4) {
      // pick the start of the first session on that day
      const candidate = dayFirstStart.get(k)!;
      if (flow4to1At === null || new Date(candidate) < new Date(flow4to1At)) {
        flow4to1At = candidate;
      }
    }
  }

  // --- streak-7: longest streak of consecutive active days ≥ 7 ---
  const allKeys = [...new Set(sorted.map((s) => localDateKey(s.start)))].sort();
  const longestStreak = longestConsecutiveRun(allKeys);
  let streak7At: string | null = null;
  if (longestStreak >= 7) {
    // Find the date of the 7th day in the first qualifying streak.
    const nums = allKeys.map(dayNumber);
    let run = 1;
    for (let i = 1; i < nums.length; i++) {
      if (nums[i]! === nums[i - 1]! + 1) {
        run++;
        if (run >= 7) {
          // allKeys[i] is the 7th (or later) day of the streak.
          streak7At = dayFirstStart.get(allKeys[i]!) ?? allKeys[i]!;
          break;
        }
      } else {
        run = 1;
      }
    }
  }

  // --- century: ≥ 100 sessions ---
  let centuryAt: string | null = null;
  if (sorted.length >= 100) {
    centuryAt = sorted[99]!.end;
  }

  return [
    {
      id: "first-hour",
      label: "First Hour",
      description: "Accumulate 1 hour of total focus time.",
      earnedAt: firstHourAt,
    },
    {
      id: "deep-diver",
      label: "Deep Diver",
      description: "Complete a single session of 90 minutes or more.",
      earnedAt: deepDiverAt,
    },
    {
      id: "budget-master",
      label: "Budget Master",
      description: "Finish a session within your break budget.",
      earnedAt: budgetMasterAt,
    },
    {
      id: "flow-4to1",
      label: "Flow 4:1",
      description:
        "Achieve a 4:1 focus-to-break ratio on any day (with at least some break time).",
      earnedAt: flow4to1At,
    },
    {
      id: "streak-7",
      label: "Week Warrior",
      description: "Maintain a 7-day consecutive focus streak.",
      earnedAt: streak7At,
    },
    {
      id: "century",
      label: "Century",
      description: "Log 100 sessions.",
      earnedAt: centuryAt,
    },
  ];
}

// ---------------------------------------------------------------------------
// Flow score
// ---------------------------------------------------------------------------

/**
 * Compute a deterministic composite flow score (0–100).
 *
 * Formula (weights sum to 1.0):
 *   (a) Volume component (weight 0.50):
 *       todayFocusS / dailyFocusGoalS, capped at 1.
 *       Rewards reaching the daily goal.
 *
 *   (b) Focus:break balance component (weight 0.35):
 *       The Flowtime healthy band is breakS ≈ 10–50% of focusS.
 *       Let ratio = breakS / focusS (0 when focusS=0 or breakS=0).
 *       Score within [0.10, 0.50]: 1.0 (full credit).
 *       Score below 0.10 (including no breaks): linear ramp 0→1 over [0, 0.10].
 *       Score above 0.50: linear decay 1→0 over [0.50, 1.0], then 0.
 *       When focusS=0: 0.
 *       Only today's focus/break are used to keep the score actionable.
 *
 *   (c) Streak bonus component (weight 0.15):
 *       min(currentStreak, 14) / 14 — a 2-week streak earns full credit.
 *
 * Final = round(100 * (0.50*a + 0.35*b + 0.15*c)), clamped [0, 100].
 */
function computeFlowScore(
  todayFocusS: number,
  todayBreakS: number,
  dailyFocusGoalS: number,
  currentStreak: number,
): number {
  // (a) volume
  const aVol = dailyFocusGoalS > 0 ? Math.min(1, todayFocusS / dailyFocusGoalS) : 0;

  // (b) focus:break balance
  let bBalance = 0;
  if (todayFocusS > 0) {
    const ratio = todayBreakS / todayFocusS;
    if (ratio >= 0.1 && ratio <= 0.5) {
      bBalance = 1.0;
    } else if (ratio < 0.1) {
      bBalance = ratio / 0.1; // linear ramp from 0 to 1 as ratio → 0.10
    } else {
      // ratio > 0.5
      bBalance = Math.max(0, 1 - (ratio - 0.5) / 0.5);
    }
  }

  // (c) streak bonus
  const cStreak = Math.min(currentStreak, 14) / 14;

  const raw = 0.5 * aVol + 0.35 * bBalance + 0.15 * cStreak;
  return Math.min(100, Math.max(0, Math.round(100 * raw)));
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Compute the full gamification summary for a set of sessions.
 *
 * @param sessions - All sessions (raw, not pre-filtered).
 * @param dailyFocusGoalS - Daily focus goal in seconds (from config).
 * @param now - Injectable clock (for tests); defaults to `new Date()`.
 */
export function computeGame(
  sessions: Session[],
  dailyFocusGoalS: number,
  now: Date = new Date(),
): GameSummary {
  const todayKey = localDateKey(now.toISOString());

  let todayFocusS = 0;
  let todayBreakS = 0;
  let allTimeFocusS = 0;
  let allTimeBreakS = 0;

  const activeDayKeys: string[] = [];

  for (const s of sessions) {
    const k = localDateKey(s.start);
    allTimeFocusS += s.durationS;
    allTimeBreakS += s.breakS;
    activeDayKeys.push(k);
    if (k === todayKey) {
      todayFocusS += s.durationS;
      todayBreakS += s.breakS;
    }
  }

  // Compute current streak (mirrors computeStreaks in stats.ts).
  const uniqueKeys = [...new Set(activeDayKeys)].sort();
  const nums = uniqueKeys.map(dayNumber);
  const activeSet = new Set(nums);
  const todayNum = dayNumber(todayKey);
  let anchor: number | null = null;
  if (activeSet.has(todayNum)) anchor = todayNum;
  else if (activeSet.has(todayNum - 1)) anchor = todayNum - 1;
  let currentStreak = 0;
  if (anchor !== null) {
    let cursor = anchor;
    while (activeSet.has(cursor)) {
      currentStreak++;
      cursor--;
    }
  }

  const dailyMaximizationPct = dailyFocusGoalS > 0
    ? Math.min(100, Math.round((todayFocusS / dailyFocusGoalS) * 100))
    : 0;

  // focus÷break ratio: inverse of breakRatio (which returns break/focus).
  const focusRestRatioTodayV = todayBreakS > 0 ? todayFocusS / todayBreakS : 0;
  const focusRestRatioAllTime = allTimeBreakS > 0 ? allTimeFocusS / allTimeBreakS : 0;

  const flowScore = computeFlowScore(
    todayFocusS,
    todayBreakS,
    dailyFocusGoalS,
    currentStreak,
  );

  const achievements = computeAchievements(sessions, now);

  return {
    flowScore,
    dailyMaximizationPct,
    focusRestRatioToday: focusRestRatioTodayV,
    focusRestRatioAllTime,
    todayFocusS,
    todayBreakS,
    achievements,
  };
}
