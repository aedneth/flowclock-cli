import type { CommandContext } from "../lib/context.js";
import { readSessions, querySessions } from "../lib/session.js";
import { sessionsPathFor } from "../lib/config.js";
import { humanDuration } from "../lib/format.js";
import { jsonSuccess, printJson } from "../lib/output.js";
import type { Break } from "../schemas/session.js";

export interface HistoryOptions {
  limit?: number;
  since?: string;
  until?: string;
}

/** Summarise break categories for inline display, e.g. "rest/meal". */
function breakCategorySummary(breaks: Break[]): string {
  if (breaks.length === 0) return "";
  const cats = [...new Set(breaks.map((b) => b.category))];
  return cats.join("/");
}

export function runHistory(ctx: CommandContext, opts: HistoryOptions): void {
  const file = sessionsPathFor(ctx.config, ctx.paths);
  const { sessions } = readSessions(file);
  const rows = querySessions(sessions, {
    limit: opts.limit,
    since: opts.since ? new Date(opts.since) : undefined,
    until: opts.until ? new Date(opts.until) : undefined,
  });

  if (ctx.json) {
    printJson(jsonSuccess("history", { count: rows.length, sessions: rows }));
    return;
  }

  if (rows.length === 0) {
    process.stdout.write("No sessions logged yet.\n");
    return;
  }

  const lines = rows.map((s) => {
    const when = new Date(s.start).toLocaleString();
    const dur = humanDuration(s.durationS).padStart(12);
    const label = s.label ? `  ${s.label}` : "";
    const goal = s.goal
      ? `  🎯 ${s.goal}${s.goalMet === true ? " ✓" : s.goalMet === false ? " ✗" : ""}`
      : "";
    // Break info: show total break time + categories when present.
    let breakInfo = "";
    if (s.breakS > 0) {
      const cats = breakCategorySummary(s.breaks);
      const catPart = cats ? `/${cats}` : "";
      breakInfo = `  · +${humanDuration(s.breakS)} rest${catPart}`;
    }
    return `${when}  ${dur}  [${s.source}]${label}${goal}${breakInfo}`;
  });
  process.stdout.write(lines.join("\n") + "\n");
}
