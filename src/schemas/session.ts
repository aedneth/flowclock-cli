import { z } from "zod";

/** Current on-disk schema version for session records. */
export const SESSION_SCHEMA_VERSION = 1;

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
  schemaVersion: z
    .literal(SESSION_SCHEMA_VERSION)
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
});
export type Session = z.infer<typeof SessionSchema>;

/** The whole `sessions.json` file: a flat append-only array. */
export const SessionFileSchema = z.array(SessionSchema);
