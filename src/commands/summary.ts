import type { CommandContext } from "../lib/context.js";
import { readSessions } from "../lib/session.js";
import { sessionsPathFor } from "../lib/config.js";
import { humanDuration } from "../lib/format.js";
import { jsonSuccess, printJson } from "../lib/output.js";
import { ExitCode, fail } from "../lib/exit.js";
import {
  parseIsoWeek,
  mondayOf,
  weekDayKeys,
  dateKey,
  currentIsoWeek,
  formatIsoWeek,
} from "../lib/week.js";
import type { Session } from "../schemas/session.js";

export interface SummaryOptions {
  /** ISO week token "YYYY-WW"; omitted = current week. */
  week?: string;
}

export interface WeekDayRow {
  date: string;
  sessions: number;
  totalS: number;
  bestS: number;
  goal: string;
}

/** Aggregate one Mon→Sun window into per-day rows (empty days included). */
export function summarizeWeek(
  sessions: Session[],
  monday: Date,
): WeekDayRow[] {
  const keys = weekDayKeys(monday);
  const byDay = new Map<string, Session[]>(keys.map((k) => [k, []]));
  for (const s of sessions) {
    const k = dateKey(new Date(s.start));
    const bucket = byDay.get(k);
    if (bucket) bucket.push(s);
  }

  return keys.map((date) => {
    const day = byDay.get(date)!;
    const totalS = day.reduce((sum, s) => sum + s.durationS, 0);
    const bestS = day.reduce((mx, s) => Math.max(mx, s.durationS), 0);
    // The day's headline goal: the one with the most active time.
    const goalTime = new Map<string, number>();
    for (const s of day) {
      if (s.goal) goalTime.set(s.goal, (goalTime.get(s.goal) ?? 0) + s.durationS);
    }
    const goal =
      [...goalTime.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "";
    return { date, sessions: day.length, totalS, bestS, goal };
  });
}

function toMarkdown(label: string, rows: WeekDayRow[]): string {
  const head = `### Week ${label}\n\n| Date | Sessions | Total | Best | Goal |\n| ---- | -------- | ----- | ---- | ---- |`;
  const body = rows.map(
    (r) =>
      `| ${r.date} | ${r.sessions} | ${r.sessions ? humanDuration(r.totalS) : "—"} | ${r.sessions ? humanDuration(r.bestS) : "—"} | ${r.goal || ""} |`,
  );
  const weekTotal = rows.reduce((s, r) => s + r.totalS, 0);
  const weekCount = rows.reduce((s, r) => s + r.sessions, 0);
  const total = `| **Total** | **${weekCount}** | **${humanDuration(weekTotal)}** | | |`;
  return [head, ...body, total].join("\n") + "\n";
}

/** `flowclock summary --week` — a markdown table for pasting into notes. */
export function runSummary(ctx: CommandContext, opts: SummaryOptions): void {
  let monday: Date;
  let label: string;
  if (opts.week) {
    const parsed = parseIsoWeek(opts.week);
    if (!parsed) {
      fail(
        ExitCode.USAGE,
        `invalid --week '${opts.week}' (expected YYYY-WW, e.g. 2026-23)`,
      );
    }
    monday = parsed;
    label = formatIsoWeek(currentIsoWeek(monday));
  } else {
    const now = new Date();
    monday = mondayOf(now);
    label = formatIsoWeek(currentIsoWeek(now));
  }

  const file = sessionsPathFor(ctx.config, ctx.paths);
  const { sessions } = readSessions(file);
  const rows = summarizeWeek(sessions, monday);

  if (ctx.json) {
    printJson(
      jsonSuccess("summary", {
        week: label,
        weekStart: dateKey(monday),
        days: rows,
      }),
    );
    return;
  }

  process.stdout.write(toMarkdown(label, rows));
}
