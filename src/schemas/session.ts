import { z } from "zod";

/**
 * Current on-disk schema version for session records.
 *
 * v1 → v2 (flowclock-cli v1.0.0): added `goal`, `goalMet`, and
 * `recmp3SessionId`. The migration is non-destructive — `readSessions()` still
 * accepts v1 records and zod fills the new fields with `null` defaults, so old
 * `sessions.json` files load unchanged. See `.brain/decisions/`.
 */
export const SESSION_SCHEMA_VERSION = 2;

/** Schema versions this build can read. New records are written at the latest. */
export const SUPPORTED_SCHEMA_VERSIONS = [1, 2] as const;

/** A single pause interval within a session. */
export const PauseSchema = z.object({
  start: z.string().datetime(),
  end: z.string().datetime(),
  durationS: z.number().int().nonnegative(),
});
export type Pause = z.infer<typeof PauseSchema>;

/** How a session was created. */
export const SessionSourceSchema = z.enum(["hud", "timed", "log"]);
export type SessionSource = z.infer<typeof SessionSourceSchema>;

/**
 * One logged Flowtime session. `durationS` is *active* time and excludes any
 * paused intervals — mirroring `flowtime.sh` (elapsed = now - start - totalPause).
 */
export const SessionSchema = z.object({
  // Accepts any supported version so v1 files keep loading; new records default
  // to the latest version.
  schemaVersion: z
    .union([z.literal(1), z.literal(2)])
    .default(SESSION_SCHEMA_VERSION),
  id: z.string().min(1),
  start: z.string().datetime(),
  end: z.string().datetime(),
  durationS: z.number().int().nonnegative(),
  pauses: z.array(PauseSchema).default([]),
  label: z.string().nullable().default(null),
  note: z.string().nullable().default(null),
  source: SessionSourceSchema.default("hud"),
  tags: z.array(z.string()).default([]),
  // --- schemaVersion 2 additions (default null → v1 records migrate cleanly) ---
  /** The goal/intention named at start (`start --goal`). */
  goal: z.string().nullable().default(null),
  /** Whether the goal was met, if the user answered the end prompt. */
  goalMet: z.boolean().nullable().default(null),
  /** Correlating recmp3-cli session id, by naming convention only. */
  recmp3SessionId: z.string().nullable().default(null),
});
export type Session = z.infer<typeof SessionSchema>;

/** The whole `sessions.json` file: a flat append-only array. */
export const SessionFileSchema = z.array(SessionSchema);
