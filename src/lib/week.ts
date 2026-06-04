/**
 * ISO-8601 week helpers for `flowclock summary --week`. Weeks run Monday→Sunday;
 * week 1 is the week containing the year's first Thursday (i.e. Jan 4th). All
 * dates are handled in local time to match how sessions are bucketed elsewhere.
 */

export interface IsoWeek {
  year: number;
  week: number;
}

/** Local YYYY-MM-DD for a Date. */
export function dateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Monday=0 … Sunday=6 for a local Date. */
function isoDow(d: Date): number {
  return (d.getDay() + 6) % 7;
}

/** The local Monday that starts the ISO week containing `date`. */
export function mondayOf(date: Date): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  d.setDate(d.getDate() - isoDow(d));
  return d;
}

/** The ISO {year, week} that `date` falls in. */
export function currentIsoWeek(date: Date = new Date()): IsoWeek {
  // Shift to the Thursday of this week — its calendar year is the ISO year.
  const thursday = mondayOf(date);
  thursday.setDate(thursday.getDate() + 3);
  const isoYear = thursday.getFullYear();
  const jan4 = new Date(isoYear, 0, 4);
  const week1Monday = mondayOf(jan4);
  const week =
    1 +
    Math.round(
      (thursday.getTime() - mondayOf(week1Monday).getTime() - 3 * 86_400_000) /
        (7 * 86_400_000),
    );
  return { year: isoYear, week };
}

/** The local Monday that starts ISO week `week` of `year`. */
export function isoWeekToMonday(year: number, week: number): Date {
  const jan4 = new Date(year, 0, 4);
  const week1Monday = mondayOf(jan4);
  const monday = new Date(week1Monday);
  monday.setDate(week1Monday.getDate() + (week - 1) * 7);
  return monday;
}

/**
 * Parse a "YYYY-WW" token into a Monday Date. Returns null on malformed input
 * or an out-of-range week (1–53), so the caller can emit a clean USAGE error.
 */
export function parseIsoWeek(token: string): Date | null {
  const m = /^(\d{4})-W?(\d{1,2})$/.exec(token.trim());
  if (!m) return null;
  const year = Number(m[1]);
  const week = Number(m[2]);
  if (week < 1 || week > 53) return null;
  return isoWeekToMonday(year, week);
}

/** Format an ISO week as "YYYY-WNN" (zero-padded). */
export function formatIsoWeek(w: IsoWeek): string {
  return `${w.year}-W${String(w.week).padStart(2, "0")}`;
}

/** The seven local day-keys (Mon→Sun) for the week starting at `monday`. */
export function weekDayKeys(monday: Date): string[] {
  const keys: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    keys.push(dateKey(d));
  }
  return keys;
}
