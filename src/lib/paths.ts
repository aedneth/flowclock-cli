import envPaths from "env-paths";
import { join } from "node:path";

export interface FlowclockPaths {
  configDir: string;
  dataDir: string;
  configFile: string;
  sessionsFile: string;
}

/**
 * Resolve cross-OS config/data directories.
 *
 * Precedence: explicit env overrides > XDG/platform defaults (via env-paths).
 * - Linux:   ~/.config/flowclock, ~/.local/share/flowclock (honors XDG_*).
 * - macOS:   ~/Library/Application Support/flowclock.
 * - Windows: %APPDATA%\flowclock.
 *
 * `env` is injected for testability.
 */
export function resolvePaths(
  env: NodeJS.ProcessEnv = process.env,
): FlowclockPaths {
  // env-paths appends a "-nodejs" suffix by default; disable it for clean dirs.
  const base = envPaths("flowclock", { suffix: "" });

  const configDir = env.FLOWCLOCK_CONFIG_DIR ?? base.config;
  const dataDir = env.FLOWCLOCK_DATA_DIR ?? base.data;

  return {
    configDir,
    dataDir,
    configFile: join(configDir, "config.json"),
    sessionsFile: join(dataDir, "sessions.json"),
  };
}
