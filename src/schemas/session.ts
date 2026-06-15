import { z } from "zod";

/**
 * Current on-disk schema version for session records.
 *
 * v1 → v2 (flowclock-cli v1.0.0): added `goal`, `goalMet`, and
 * `recmp3SessionId`. The migration is non-destructive — `readSessions()` still
 * accepts v1 records and zod fills the new fields with `null` defaults, so old
 * `sessions.json` files load unchanged. See `.brain/decisions/`.
 *
 * v2 → v3 (flowclock-cli v2.0.0): added `breaks`, `breakS`, `focusTargetS`,
 * and `breakBudgetS`. `durationS` still represents active focus seconds
 * (excludes break time). The legacy `pauses` field is kept for backward
 * compatibility; at read time, v1/v2 records with `pauses` and empty `breaks`
 * are normalized — `breaks` is derived from `pauses` with category "rest" and
 * `breakS` is summed. New records write `breaks` as canonical and leave
 * `pauses` empty.
 */
export const SESSION_SCHEMA_VERSION = 3;

/** Schema versions this build can read. New records are written at the latest. */
export const SUPPORTED_SCHEMA_VERSIONS = [1, 2, 3] as const;

/** A single pause interval within a session. */
export const PauseSchema = z.object({
  start: z.string().datetime(),
  end: z.string().datetime(),
  durationS: z.number().int().nonnegative(),
});
export type Pause = z.infer<typeof PauseSchema>;

/** Category for a break interval within a session. */
export const BreakCategorySchema = z.enum([
  "rest",
  "meal",
  "exercise",
  "walk",
  "distraction",
  "other",
  "coffee",
  "sleep",
]);
export type BreakCategory = z.infer<typeof BreakCategorySchema>;

/** Every break category, in canonical order (single source of truth). */
export const ALL_BREAK_CATEGORIES: readonly BreakCategory[] =
  BreakCategorySchema.options;

/**
 * The six categories bound to number keys 1–6 in the live session footer. The
 * rest (coffee, sleep, …) are reachable through the break-category picker so the
 * footer stays uncluttered as the list grows.
 */
export const QUICK_BREAK_CATEGORIES: readonly BreakCategory[] =
  BreakCategorySchema.options.slice(0, 6);

/** A single break interval within a session. */
export const BreakSchema = z.object({
  start: z.string().datetime(),
  end: z.string().datetime(),
  durationS: z.number().int().nonnegative(),
  category: BreakCategorySchema.default("rest"),
  label: z.string().nullable().default(null),
  suggestedS: z.number().int().nonnegative().nullable().default(null),
});
export type Break = z.infer<typeof BreakSchema>;

/** How a session was created. */
export const SessionSourceSchema = z.enum(["hud", "timed", "log"]);
export type SessionSource = z.infer<typeof SessionSourceSchema>;

/**
 * One logged Flowtime session. `durationS` is *active* time and excludes any
 * break intervals — mirroring `flowtime.sh` (elapsed = now - start - totalPause).
 */
export const SessionSchema = z.object({
  // Accepts any supported version so v1 files keep loading; new records default
  // to the latest version.
  schemaVersion: z
    .union([z.literal(1), z.literal(2), z.literal(3)])
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
  // --- schemaVersion 3 additions (all default-safe → v1/v2 records still parse) ---
  /** Categorized break intervals (canonical in v3; derived from pauses on read for v1/v2). */
  breaks: z.array(BreakSchema).default([]),
  /** Total break seconds (sum of breaks[].durationS). */
  breakS: z.number().int().nonnegative().default(0),
  /** Optional focus target in seconds for this session. */
  focusTargetS: z.number().int().nonnegative().nullable().default(null),
  /** Optional break budget in seconds for this session. */
  breakBudgetS: z.number().int().nonnegative().nullable().default(null),
});
export type Session = z.infer<typeof SessionSchema>;

/** The whole `sessions.json` file: a flat append-only array. */
export const SessionFileSchema = z.array(SessionSchema);
