/**
 * `flowclock dashboard` — interactive Flowtime dashboard (TUI).
 *
 * In a TTY: launches the full alt-screen TUI.
 * Agent / non-TTY / --json: prints a one-shot DashboardSnapshot as JSON.
 */

import type { CommandContext } from "../lib/context.js";
import { readSessions } from "../lib/session.js";
import { sessionsPathFor } from "../lib/config.js";
import { buildSnapshot } from "../lib/snapshot.js";
import { jsonSuccess, printJson } from "../lib/output.js";
import { runDashboardApp } from "../tui/app.js";

// No additional options beyond the global flags at this stage.
export type DashboardOptions = Record<string, never>;

/**
 * Entry point for the `dashboard` command.
 *
 * - If `ctx.json` is true OR stdout is not a TTY (`!ctx.isTTY`):
 *   prints a JSON snapshot envelope and returns immediately (agent-safe).
 * - Otherwise: launches the interactive TUI dashboard.
 */
export async function runDashboard(
  ctx: CommandContext,
  _opts: DashboardOptions = {},
): Promise<void> {
  const file = sessionsPathFor(ctx.config, ctx.paths);
  const { sessions } = readSessions(file);

  if (ctx.json || !ctx.isTTY) {
    const snap = buildSnapshot(sessions, ctx.config.dailyFocusGoalS);
    printJson(jsonSuccess("dashboard", snap));
    return;
  }

  await runDashboardApp(ctx, sessions);
}
