import { loadConfig } from "./config.js";
import { resolvePaths, type FlowclockPaths } from "./paths.js";
import { createLogger, type Logger } from "./logger.js";
import { colorEnabled } from "./theme.js";
import { jsonRequested } from "./output.js";
import type { Config } from "../schemas/config.js";

/** Global options parsed once by the CLI and threaded into every command. */
export interface GlobalOptions {
  json?: boolean;
  yes?: boolean;
  color?: boolean; // commander sets this false for --no-color
  config?: string;
  quiet?: boolean;
  verbose?: boolean;
}

/** Everything a command handler needs. Built once in cli.ts. */
export interface CommandContext {
  config: Config;
  paths: FlowclockPaths;
  logger: Logger;
  json: boolean;
  color: boolean;
  yes: boolean;
  isTTY: boolean;
  env: NodeJS.ProcessEnv;
}

export function buildContext(
  global: GlobalOptions,
  env: NodeJS.ProcessEnv = process.env,
): CommandContext {
  const paths = resolvePaths(env);
  if (global.config) {
    paths.configFile = global.config;
  }
  const config = loadConfig(paths);
  const json = jsonRequested(global.json, env);
  const isTTY = Boolean(process.stdout.isTTY);
  const color = colorEnabled({
    noColor: global.color === false,
    isTTY,
    env,
  });
  const yes = Boolean(global.yes) || env.FLOWCLOCK_YES === "1";

  return {
    config,
    paths,
    logger: createLogger({ quiet: global.quiet }),
    json,
    color,
    yes,
    isTTY,
    env,
  };
}
