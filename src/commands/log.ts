import { readFileSync } from "node:fs";
import type { CommandContext } from "../lib/context.js";
import { appendSession, makeSessionId } from "../lib/session.js";
import { sessionsPathFor } from "../lib/config.js";
import { SessionSchema, type Session } from "../schemas/session.js";
import { jsonSuccess, printJson } from "../lib/output.js";
import { ExitCode, fail } from "../lib/exit.js";

export interface LogOptions {
  duration?: number;
  start?: string;
  end?: string;
  label?: string;
  note?: string;
  tags?: string;
  goal?: string;
  recmp3SessionId?: string;
}

/** Read all of stdin synchronously, or null if stdin is an interactive TTY. */
function readStdin(): string | null {
  if (process.stdin.isTTY) return null;
  try {
    const data = readFileSync(0, "utf8");
    return data.trim() === "" ? null : data;
  } catch {
    return null;
  }
}

export function runLog(ctx: CommandContext, opts: LogOptions): void {
  const file = sessionsPathFor(ctx.config, ctx.paths);

  // Path 1: a full/partial session record piped on stdin.
  const piped = readStdin();
  let session: Session;

  if (piped) {
    let raw: unknown;
    try {
      raw = JSON.parse(piped);
    } catch {
      fail(ExitCode.USAGE, "stdin is not valid JSON");
    }
    const withId =
      raw && typeof raw === "object" && !("id" in raw)
        ? { ...(raw as object), id: makeSessionId(new Date()) }
        : raw;
    const parsed = SessionSchema.safeParse(withId);
    if (!parsed.success) {
      fail(
        ExitCode.USAGE,
        `stdin session failed validation: ${parsed.error.issues
          .map((i) => `${i.path.join(".")}: ${i.message}`)
          .join("; ")}`,
      );
    }
    session = parsed.data;
  } else {
    // Path 2: build from flags. --duration is required here.
    if (opts.duration === undefined || Number.isNaN(opts.duration)) {
      fail(
        ExitCode.USAGE,
        "log requires --duration <seconds> (or a session JSON on stdin)",
      );
    }
    const end = opts.end ? new Date(opts.end) : new Date();
    const start = opts.start
      ? new Date(opts.start)
      : new Date(end.getTime() - opts.duration * 1000);
    session = SessionSchema.parse({
      id: makeSessionId(start),
      start: start.toISOString(),
      end: end.toISOString(),
      durationS: Math.floor(opts.duration),
      pauses: [],
      label: opts.label ?? null,
      note: opts.note ?? null,
      source: "log",
      tags: opts.tags ? opts.tags.split(",").map((t) => t.trim()) : [],
      goal: opts.goal ?? null,
      recmp3SessionId: opts.recmp3SessionId ?? null,
    });
  }

  const stored = appendSession(file, session);
  if (ctx.json) {
    printJson(jsonSuccess("log", stored));
  } else {
    ctx.logger.info(`logged session ${stored.id} (${stored.durationS}s)`);
  }
}
