import type { CommandContext } from "../lib/context.js";
import { readSessions, querySessions } from "../lib/session.js";
import { sessionsPathFor } from "../lib/config.js";
import { computeStats } from "../lib/stats.js";
import { humanDuration } from "../lib/format.js";
import { jsonSuccess, printJson } from "../lib/output.js";
import { paint } from "../lib/theme.js";

export interface StatsOptions {
  week?: boolean;
  since?: string;
}

export function runStats(ctx: CommandContext, opts: StatsOptions): void {
  const file = sessionsPathFor(ctx.config, ctx.paths);
  const { sessions } = readSessions(file);
  const filtered = opts.since
    ? querySessions(sessions, { since: new Date(opts.since) })
    : sessions;
  const summary = computeStats(filtered);

  if (ctx.json) {
    printJson(jsonSuccess("stats", summary));
    return;
  }

  const c = (t: string) => paint(t, ctx.config.theme, ctx.color);
  const lines = [
    `${c("Today")}      ${humanDuration(summary.todayTotalS)}  (${summary.todayCount} session${summary.todayCount === 1 ? "" : "s"})`,
    `${c("All-time")}   ${humanDuration(summary.allTimeTotalS)}  (${summary.allTimeCount} session${summary.allTimeCount === 1 ? "" : "s"})`,
    `${c("Best")}       ${humanDuration(summary.bestSessionS)}`,
    `${c("Average")}    ${humanDuration(summary.averageSessionS)}`,
  ];

  // Weekly summary is always shown in human mode (overview: "+ weekly summary").
  lines.push("", c("Last 7 days"));
  for (const day of summary.week) {
    lines.push(
      `  ${day.date}  ${humanDuration(day.totalS).padStart(12)}  ${day.count}×`,
    );
  }
  process.stdout.write(lines.join("\n") + "\n");
}
