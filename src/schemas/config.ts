import { z } from "zod";

/** Current on-disk schema version for the config file. */
export const CONFIG_SCHEMA_VERSION = 1;

export const ThemeNameSchema = z.enum(["neon", "amber", "blue", "mono"]);
export type ThemeName = z.infer<typeof ThemeNameSchema>;

/**
 * HUD / counter display style:
 *  - "block"   solid block glyphs (default)
 *  - "simple"  clean heavy box-drawing seven-segment digits
 *  - "outline" hollow DOUBLE-LINE silhouette glyphs (╔═╗ ║ ╚╝ — distinct at every scale)
 *  - "minimal" clean light box-drawing seven-segment digits (airy line font)
 *  - "classic" solid cornered/rounded terminal numerals (distinct shape, native 5-row)
 *  - "bold"    solid heavy-slab terminal numerals (distinct shape, heavier weight)
 */
export const DisplayStyleSchema = z.enum([
  "simple",
  "block",
  "outline",
  "minimal",
  "classic",
  "bold",
]);
export type DisplayStyle = z.infer<typeof DisplayStyleSchema>;

export const KeybindingsSchema = z.object({
  pause: z.string().length(1).default("p"),
  reset: z.string().length(1).default("r"),
  quit: z.string().length(1).default("q"),
  break: z.string().length(1).default("b"),
  category: z.string().length(1).default("c"),
});
export type Keybindings = z.infer<typeof KeybindingsSchema>;

export const ConfigSchema = z.object({
  schemaVersion: z
    .literal(CONFIG_SCHEMA_VERSION)
    .default(CONFIG_SCHEMA_VERSION),
  theme: ThemeNameSchema.default("neon"),
  keybindings: KeybindingsSchema.default({
    pause: "p",
    reset: "r",
    quit: "q",
    break: "b",
    category: "c",
  }),
  /** Override path for sessions.json. `null` = default data dir. */
  sessionsPath: z.string().nullable().default(null),
  /** Optional JSON push endpoint (v0.3.0). */
  apiEndpoint: z.string().url().nullable().default(null),
  /** Optional big ASCII display (v0.3.0). */
  bigFont: z.boolean().default(false),
  /** Counter display style: block (default) · simple · outline · minimal · classic · bold. */
  displayStyle: DisplayStyleSchema.default("block"),
  /** Whether to show the key-controls legend in the HUD. */
  showControls: z.boolean().default(true),
  /** Daily focus goal in seconds (default 4 h). */
  dailyFocusGoalS: z.number().int().positive().default(14400),
});
export type Config = z.infer<typeof ConfigSchema>;

/** A fully-defaulted config object (parsing an empty object fills defaults). */
export const DEFAULT_CONFIG: Config = ConfigSchema.parse({});

/** Keys that `config set` is allowed to write, with their value parsers. */
export const SETTABLE_KEYS = [
  "theme",
  "keybindings.pause",
  "keybindings.reset",
  "keybindings.quit",
  "keybindings.break",
  "keybindings.category",
  "sessionsPath",
  "apiEndpoint",
  "bigFont",
  "displayStyle",
  "showControls",
  "dailyFocusGoalS",
] as const;
export type SettableKey = (typeof SETTABLE_KEYS)[number];
