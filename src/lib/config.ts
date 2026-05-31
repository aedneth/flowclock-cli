import { readFileSync, existsSync } from "node:fs";
import { writeFileAtomic } from "./fsutil.js";
import {
  ConfigSchema,
  DEFAULT_CONFIG,
  SETTABLE_KEYS,
  type Config,
  type SettableKey,
} from "../schemas/config.js";
import { resolvePaths, type FlowclockPaths } from "./paths.js";
import { ExitCode, fail } from "./exit.js";

/** Load config, merging stored values over defaults. Missing file = defaults. */
export function loadConfig(paths: FlowclockPaths = resolvePaths()): Config {
  if (!existsSync(paths.configFile)) {
    return { ...DEFAULT_CONFIG };
  }
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(paths.configFile, "utf8"));
  } catch {
    fail(ExitCode.CONFIG, `config file is not valid JSON: ${paths.configFile}`);
  }
  const parsed = ConfigSchema.safeParse(raw);
  if (!parsed.success) {
    fail(
      ExitCode.CONFIG,
      `config file failed validation: ${parsed.error.issues
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join("; ")}`,
    );
  }
  return parsed.data;
}

/** Persist config atomically (temp file + rename). */
export function saveConfig(
  config: Config,
  paths: FlowclockPaths = resolvePaths(),
): void {
  writeFileAtomic(paths.configFile, JSON.stringify(config, null, 2) + "\n");
}

/** Read a single config value by dotted key. */
export function getConfigValue(config: Config, key: string): unknown {
  if (key === "keybindings") return config.keybindings;
  if (key.startsWith("keybindings.")) {
    const sub = key.slice("keybindings.".length) as keyof Config["keybindings"];
    return config.keybindings[sub];
  }
  if (key in config) return (config as Record<string, unknown>)[key];
  fail(ExitCode.USAGE, `unknown config key: ${key}`);
}

/**
 * Return a new config with `key` set to `value` (string from CLI), validated.
 * Throws USAGE on unknown/unsettable keys or values that fail validation.
 */
export function setConfigValue(
  config: Config,
  key: string,
  value: string,
): Config {
  if (!SETTABLE_KEYS.includes(key as SettableKey)) {
    fail(
      ExitCode.USAGE,
      `cannot set "${key}". Settable keys: ${SETTABLE_KEYS.join(", ")}`,
    );
  }

  const next: Config = structuredClone(config);
  switch (key) {
    case "theme":
      next.theme = value as Config["theme"];
      break;
    case "keybindings.pause":
      next.keybindings.pause = value;
      break;
    case "keybindings.reset":
      next.keybindings.reset = value;
      break;
    case "keybindings.quit":
      next.keybindings.quit = value;
      break;
    case "sessionsPath":
      next.sessionsPath = value === "" || value === "null" ? null : value;
      break;
    case "apiEndpoint":
      next.apiEndpoint = value === "" || value === "null" ? null : value;
      break;
    case "bigFont":
      next.bigFont = value === "true" || value === "1";
      break;
  }

  const parsed = ConfigSchema.safeParse(next);
  if (!parsed.success) {
    fail(
      ExitCode.USAGE,
      `invalid value for ${key}: ${parsed.error.issues
        .map((i) => i.message)
        .join("; ")}`,
    );
  }
  return parsed.data;
}

/** Resolve where sessions.json lives (config override wins over default dir). */
export function sessionsPathFor(
  config: Config,
  paths: FlowclockPaths = resolvePaths(),
): string {
  return config.sessionsPath ?? paths.sessionsFile;
}
