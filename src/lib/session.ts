import { existsSync, readFileSync, renameSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { writeFileAtomic } from "./fsutil.js";
import { SessionSchema, type Session } from "../schemas/session.js";
import { ExitCode, fail } from "./exit.js";

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
  return { sessions: result.data };
}

/** Append one session and persist atomically. Returns the stored record. */
export function appendSession(file: string, session: Session): Session {
  const validated = SessionSchema.parse(session);
  const { sessions } = readSessions(file);
  sessions.push(validated);
  writeFileAtomic(file, JSON.stringify(sessions, null, 2) + "\n");
  return validated;
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
