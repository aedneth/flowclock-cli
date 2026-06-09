import type { Session } from "../schemas/session.js";

export interface DayBucket {
  /** YYYY-MM-DD (local). */
  date: string;
  totalS: number;
  count: number;
}

export interface StatsSummary {
  todayTotalS: number;
  todayCount: number;
  /** Break seconds on today's sessions. */
  todayBreakS: number;
  allTimeTotalS: number;
  allTimeCount: number;
  /** All-time break seconds across all sessions. */
  allTimeBreakS: number;
  /** All-time focus÷break ratio (focus/break); 0 when no breaks. */
  focusRestRatioAllTime: number;
  bestSessionS: number;
  averageSessionS: number;
  /** Consecutive local days (ending today/yesterday) with ≥1 session. */
  currentStreak: number;
  /** Longest run of consecutive active days ever. */
  longestStreak: number;
  /** Local YYYY-MM-DD of the most recent session, or null if none. */
  lastSessionDate: string | null;
  /** Last 7 local days, oldest → newest. */
  week: DayBucket[];
}

function localDateKey(iso: string): string {
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Calendar-day index for a local YYYY-MM-DD key (for run-length math). */
function dayNumber(key: string): number {
  const [y, m, d] = key.split("-").map(Number);
  return Math.floor(Date.UTC(y!, m! - 1, d!) / 86_400_000);
}

interface StreakResult {
  current: number;
  longest: number;
  lastSessionDate: string | null;
}

/** Streaks over the set of local days that have ≥1 session. */
export function computeStreaks(activeKeys: string[], now: Date): StreakResult {
  if (activeKeys.length === 0) {
    return { current: 0, longest: 0, lastSessionDate: null };
  }
  const days = [...new Set(activeKeys.map(dayNumber))].sort((a, b) => a - b);
  const active = new Set(days);

  let longest = 1;
  let run = 1;
  for (let i = 1; i < days.length; i++) {
    run = days[i]! === days[i - 1]! + 1 ? run + 1 : 1;
    if (run > longest) longest = run;
  }

  const todayNum = dayNumber(localDateKey(now.toISOString()));
  // The streak is "current" if the most recent active day is today or yesterday.
  let anchor: number | null = null;
  if (active.has(todayNum)) anchor = todayNum;
  else if (active.has(todayNum - 1)) anchor = todayNum - 1;

  let current = 0;
  if (anchor !== null) {
    let cursor = anchor;
    while (active.has(cursor)) {
      current += 1;
      cursor -= 1;
    }
  }

  const lastNum = days[days.length - 1]!;
  const lastSessionDate = activeKeys
    .map((k) => ({ k, n: dayNumber(k) }))
    .filter((x) => x.n === lastNum)[0]!.k;

  return { current, longest, lastSessionDate };
}

/**
 * Aggregate sessions into a stats summary. `now` is injectable for tests.
 * "Today" and the weekly buckets are computed in local time.
 */
export function computeStats(
  sessions: Session[],
  now: Date = new Date(),
): StatsSummary {
  const todayKey = localDateKey(now.toISOString());

  let todayTotalS = 0;
  let todayCount = 0;
  let todayBreakS = 0;
  let allTimeTotalS = 0;
  let allTimeBreakS = 0;
  let bestSessionS = 0;

  const byDay = new Map<string, DayBucket>();
  for (const s of sessions) {
    const key = localDateKey(s.start);
    allTimeTotalS += s.durationS;
    allTimeBreakS += s.breakS;
    if (s.durationS > bestSessionS) bestSessionS = s.durationS;
    if (key === todayKey) {
      todayTotalS += s.durationS;
      todayCount += 1;
      todayBreakS += s.breakS;
    }
    const bucket = byDay.get(key) ?? { date: key, totalS: 0, count: 0 };
    bucket.totalS += s.durationS;
    bucket.count += 1;
    byDay.set(key, bucket);
  }

  const week: DayBucket[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const key = localDateKey(d.toISOString());
    week.push(byDay.get(key) ?? { date: key, totalS: 0, count: 0 });
  }

  const streaks = computeStreaks([...byDay.keys()], now);

  return {
    todayTotalS,
    todayCount,
    todayBreakS,
    allTimeTotalS,
    allTimeCount: sessions.length,
    allTimeBreakS,
    focusRestRatioAllTime: allTimeBreakS > 0 ? allTimeTotalS / allTimeBreakS : 0,
    bestSessionS,
    averageSessionS: sessions.length
      ? Math.round(allTimeTotalS / sessions.length)
      : 0,
    currentStreak: streaks.current,
    longestStreak: streaks.longest,
    lastSessionDate: streaks.lastSessionDate,
    week,
  };
}
