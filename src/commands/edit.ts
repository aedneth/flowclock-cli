import type { CommandContext } from "../lib/context.js";
import { readSessions, updateSession } from "../lib/session.js";
import { sessionsPathFor } from "../lib/config.js";
import type { SessionEditPatch } from "../lib/session-edit.js";
import { humanDuration } from "../lib/format.js";
import { jsonSuccess, printJson } from "../lib/output.js";
import { ExitCode, fail } from "../lib/exit.js";

export interface EditOptions {
  /** Pre-parsed new focus seconds (from --focus via cli.ts). */
  focusS?: number;
  /** Pre-parsed new total break seconds (from --break via cli.ts). */
  breakS?: number;
  /** New goal text, or empty string to clear. */
  goal?: string;
  /** New label/name text, or empty string to clear. */
  name?: string;
}

/**
 * Resolve a session id from an exact match, else a unique prefix. Fails with a
 * helpful message when nothing matches or the prefix is ambiguous.
 */
function resolveId(ids: string[], query: string): string {
  if (ids.includes(query)) return query;
  const matches = ids.filter((id) => id.startsWith(query));
  if (matches.length === 1) return matches[0]!;
  if (matches.length === 0) {
    fail(ExitCode.USAGE, `no session matches id ${JSON.stringify(query)}`);
  }
  fail(
    ExitCode.USAGE,
    `id ${JSON.stringify(query)} is ambiguous (${matches.length} matches) — use more characters`,
  );
}

/**
 * `flowclock edit <id> --focus 90m --break 15m --goal "…" --name "…"`.
 *
 * Surgically edits a logged session's essential values. The start timestamp is
 * immutable; the end timestamp and break timeline are recomputed automatically
 * from the edited focus/break totals (same engine the dashboard uses).
 */
export function runEdit(ctx: CommandContext, id: string, opts: EditOptions): void {
  const file = sessionsPathFor(ctx.config, ctx.paths);

  const patch: SessionEditPatch = {};
  if (opts.focusS !== undefined) patch.focusS = opts.focusS;
  if (opts.breakS !== undefined) patch.breakS = opts.breakS;
  if (opts.goal !== undefined) patch.goal = opts.goal === "" ? null : opts.goal;
  if (opts.name !== undefined) patch.label = opts.name === "" ? null : opts.name;

  if (Object.keys(patch).length === 0) {
    fail(
      ExitCode.USAGE,
      "nothing to edit — pass at least one of --focus, --break, --goal, --name",
    );
  }

  const { sessions } = readSessions(file);
  if (sessions.length === 0) {
    fail(ExitCode.USAGE, "no sessions to edit");
  }
  const resolved = resolveId(sessions.map((s) => s.id), id);

  const updated = updateSession(file, resolved, patch);
  if (!updated) {
    // resolveId guarantees a match, so this only fires on a concurrent delete.
    fail(ExitCode.DATA, `session ${resolved} disappeared before it could be edited`);
  }

  if (ctx.json) {
    printJson(jsonSuccess("edit", updated));
  } else {
    const parts = [`focus ${humanDuration(updated.durationS)}`];
    if (updated.breakS > 0) parts.push(`break ${humanDuration(updated.breakS)}`);
    if (updated.goal) parts.push(`goal "${updated.goal}"`);
    ctx.logger.info(`edited session ${updated.id} → ${parts.join(", ")}`);
  }
}
