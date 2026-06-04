import type { CommandContext } from "../lib/context.js";
import { readSessions, querySessions } from "../lib/session.js";
import { sessionsPathFor } from "../lib/config.js";
import { humanDuration } from "../lib/format.js";
import { jsonSuccess, printJson } from "../lib/output.js";

export interface HistoryOptions {
  limit?: number;
  since?: string;
  until?: string;
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
    return `${when}  ${dur}  [${s.source}]${label}${goal}`;
  });
  process.stdout.write(lines.join("\n") + "\n");
}
