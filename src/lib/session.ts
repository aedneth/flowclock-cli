import { existsSync, readFileSync, renameSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { writeFileAtomic } from "./fsutil.js";
import { SessionSchema, type Session } from "../schemas/session.js";
import { recomputeSession, type SessionEditPatch } from "./session-edit.js";
import { ExitCode, fail } from "./exit.js";

/**
 * Normalize a parsed session for read-time back-compat.
 *
 * If the session has legacy `pauses` but no `breaks` (v1/v2 record), derive
 * `breaks` from `pauses` with category "rest". Then if `breakS` is still 0,
 * compute it as the sum of `breaks[].durationS`. Idempotent.
 */
export function normalizeSession(s: Session): Session {
  let breaks = s.breaks;
  let breakS = s.breakS;

  if (breaks.length === 0 && s.pauses.length > 0) {
    breaks = s.pauses.map((p) => ({
      start: p.start,
      end: p.end,
      durationS: p.durationS,
      category: "rest" as const,
      label: null,
      suggestedS: null,
    }));
  }

  if (breakS === 0 && breaks.length > 0) {
    breakS = breaks.reduce((sum, b) => sum + b.durationS, 0);
  }

  return { ...s, breaks, breakS };
}

export interface ReadResult {
  sessions: Session[];
  /** Path the corrupt file was backed up to, if recovery happened. */
  recoveredBackup?: string;
}

/** Generate a sortable, collision-resistant session id from a start time. */
export function makeSessionId(start: Date): string {
  const stamp = start.toISOString().replace(/[:.]/g, "-").replace("Z", "");
  return `${stamp}-${randomBytes(2).toString("hex")}`;
}

/**
 * Read and validate sessions.json.
 *
 * Missing file → empty list. Corrupt/invalid file → back it up to
 * `sessions.corrupt-<ts>.json` and return an empty list, recording the backup
 * path so `doctor` can surface it. Throws DATA only if the backup itself fails.
 */
export function readSessions(file: string): ReadResult {
  if (!existsSync(file)) return { sessions: [] };

  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(file, "utf8"));
  } catch {
    return { sessions: [], recoveredBackup: backupCorrupt(file) };
  }

  const result = SessionSchema.array().safeParse(parsed);
  if (!result.success) {
    return { sessions: [], recoveredBackup: backupCorrupt(file) };
  }
  return { sessions: result.data.map(normalizeSession) };
}

/** Append one session and persist atomically. Returns the stored record. */
export function appendSession(file: string, session: Session): Session {
  const validated = SessionSchema.parse(session);
  const { sessions } = readSessions(file);
  sessions.push(validated);
  writeFileAtomic(file, JSON.stringify(sessions, null, 2) + "\n");
  return validated;
}

/**
 * Delete the session with the given id and persist atomically. Returns the
 * remaining sessions. A no-op (still rewrites identically) when the id is not
 * found, so callers can treat it as idempotent.
 */
export function deleteSession(file: string, id: string): Session[] {
  const { sessions } = readSessions(file);
  const remaining = sessions.filter((s) => s.id !== id);
  writeFileAtomic(file, JSON.stringify(remaining, null, 2) + "\n");
  return remaining;
}

/**
 * Recompute and persist a surgical edit to one session, atomically. Looks the
 * session up by id, applies `recomputeSession` (auto-recomputes end + break
 * timeline from the edited focus/break totals), and rewrites the file.
 *
 * Returns the updated record, or `null` when no session matches the id (the
 * file is left untouched in that case).
 */
export function updateSession(
  file: string,
  id: string,
  patch: SessionEditPatch,
): Session | null {
  const { sessions } = readSessions(file);
  const idx = sessions.findIndex((s) => s.id === id);
  if (idx === -1) return null;

  const updated = recomputeSession(sessions[idx]!, patch);
  sessions[idx] = updated;
  writeFileAtomic(file, JSON.stringify(sessions, null, 2) + "\n");
  return updated;
}

/** Filter/limit options shared by stats and history. */
export interface QueryOptions {
  since?: Date;
  until?: Date;
  limit?: number;
}

/** Sessions whose start falls in [since, until], newest first, optional limit. */
export function querySessions(
  sessions: Session[],
  opts: QueryOptions = {},
): Session[] {
  let out = sessions.filter((s) => {
    const start = new Date(s.start).getTime();
    if (opts.since && start < opts.since.getTime()) return false;
    if (opts.until && start > opts.until.getTime()) return false;
    return true;
  });
  out = out.sort(
    (a, b) => new Date(b.start).getTime() - new Date(a.start).getTime(),
  );
  if (opts.limit !== undefined && opts.limit >= 0) {
    out = out.slice(0, opts.limit);
  }
  return out;
}

function backupCorrupt(file: string): string {
  const ts = new Date().toISOString().replace(/[:.]/g, "-").replace("Z", "");
  const backup = `${file}.corrupt-${ts}.json`;
  try {
    renameSync(file, backup);
  } catch {
    fail(
      ExitCode.DATA,
      `sessions file is corrupt and could not be backed up: ${file}`,
    );
  }
  return backup;
}
