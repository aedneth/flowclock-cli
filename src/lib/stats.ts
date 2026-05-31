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
  allTimeTotalS: number;
  allTimeCount: number;
  bestSessionS: number;
  averageSessionS: number;
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
  let allTimeTotalS = 0;
  let bestSessionS = 0;

  const byDay = new Map<string, DayBucket>();
  for (const s of sessions) {
    const key = localDateKey(s.start);
    allTimeTotalS += s.durationS;
    if (s.durationS > bestSessionS) bestSessionS = s.durationS;
    if (key === todayKey) {
      todayTotalS += s.durationS;
      todayCount += 1;
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

  return {
    todayTotalS,
    todayCount,
    allTimeTotalS,
    allTimeCount: sessions.length,
    bestSessionS,
    averageSessionS: sessions.length
      ? Math.round(allTimeTotalS / sessions.length)
      : 0,
    week,
  };
}
