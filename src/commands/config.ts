import type { CommandContext } from "../lib/context.js";
import { getConfigValue, setConfigValue, saveConfig } from "../lib/config.js";
import { jsonSuccess, printJson } from "../lib/output.js";
import { ExitCode, fail } from "../lib/exit.js";

export type ConfigAction = "get" | "set" | "list" | "path";

/**
 * config subcommands. `edit` is intentionally omitted from agent mode (it would
 * spawn $EDITOR and require a TTY); `list`/`get`/`set`/`path` cover automation.
 */
export function runConfig(
  ctx: CommandContext,
  action: ConfigAction,
  args: string[],
): void {
  switch (action) {
    case "list": {
      if (ctx.json) return printJson(jsonSuccess("config", ctx.config));
      process.stdout.write(JSON.stringify(ctx.config, null, 2) + "\n");
      return;
    }
    case "path": {
      const data = { configFile: ctx.paths.configFile };
      if (ctx.json) return printJson(jsonSuccess("config", data));
      process.stdout.write(ctx.paths.configFile + "\n");
      return;
    }
    case "get": {
      const key = args[0];
      if (!key) fail(ExitCode.USAGE, "config get requires a <key>");
      const value = getConfigValue(ctx.config, key);
      if (ctx.json) return printJson(jsonSuccess("config", { key, value }));
      process.stdout.write(String(value) + "\n");
      return;
    }
    case "set": {
      const [key, value] = args;
      if (!key || value === undefined) {
        fail(ExitCode.USAGE, "config set requires <key> <value>");
      }
      const next = setConfigValue(ctx.config, key, value);
      saveConfig(next, ctx.paths);
      if (ctx.json) {
        return printJson(
          jsonSuccess("config", { key, value: getConfigValue(next, key) }),
        );
      }
      ctx.logger.info(`set ${key} = ${value}`);
      return;
    }
  }
}
