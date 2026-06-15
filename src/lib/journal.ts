/**
 * Crash-recovery journal for the live dashboard session.
 *
 * While a session is running we periodically write a snapshot of it to disk
 * (focus so far, breaks, goal, details, targets) tagged with a `heartbeat`
 * timestamp. On a normal stop/cancel the journal is deleted. If the process is
 * killed instead — a freeze, a hard reset, an OOM — the journal survives, and
 * the next launch detects the orphan and offers to resume it (à la
 * `claude --resume`).
 *
 * The snapshot reuses the Timer's own `toSession()` serializer, so a recovered
 * session reconstructs through the exact same code path a normal one would.
 */

import { existsSync, readFileSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { writeFileAtomic } from "./fsutil.js";
import { sessionsPathFor } from "./config.js";
import type { Config } from "../schemas/config.js";
import { resolvePaths, type FlowclockPaths } from "./paths.js";
import {
  BreakCategorySchema,
  SessionSchema,
  type BreakCategory,
  type Session,
} from "../schemas/session.js";
import { z } from "zod";

/** The on-disk active-session record. */
export const ActiveSessionSchema = z.object({
  v: z.literal(1),
  /** Epoch ms of the last write — how far the recovery is trusted. */
  heartbeat: z.number().int().nonnegative(),
  /** Whether the timer was on a break at the heartbeat (informational). */
  onBreak: z.boolean().default(false),
  /** Category of the break in progress at the heartbeat, if any. */
  breakCategory: BreakCategorySchema.default("rest"),
  /** The session-so-far snapshot (durationS = focus, breaks closed). */
  session: SessionSchema,
});
export type ActiveSession = z.infer<typeof ActiveSessionSchema>;

/** Path of the active-session journal, next to sessions.json. */
export function journalPathFor(
  config: Config,
  paths: FlowclockPaths = resolvePaths(),
): string {
  return join(dirname(sessionsPathFor(config, paths)), "active-session.json");
}

export interface JournalInput {
  session: Session;
  onBreak: boolean;
  breakCategory: BreakCategory;
  heartbeat?: number;
}

/** Write (or overwrite) the journal atomically. */
export function writeJournal(file: string, input: JournalInput): void {
  const rec: ActiveSession = {
    v: 1,
    heartbeat: input.heartbeat ?? Date.now(),
    onBreak: input.onBreak,
    breakCategory: input.breakCategory,
    session: input.session,
  };
  writeFileAtomic(file, JSON.stringify(rec) + "\n");
}

/**
 * Read and validate the journal. Returns null if it's missing, unreadable, or
 * malformed (a corrupt journal must never block startup or crash the app).
 */
export function readJournal(file: string): ActiveSession | null {
  if (!existsSync(file)) return null;
  try {
    const parsed = ActiveSessionSchema.safeParse(JSON.parse(readFileSync(file, "utf8")));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

/** Delete the journal. No-op if it's already gone. */
export function clearJournal(file: string): void {
  try {
    rmSync(file, { force: true });
  } catch {
    /* best-effort; a stale journal is harmless and re-offered next launch */
  }
}
