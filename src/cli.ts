import { Command, InvalidArgumentError } from "commander";
import { VERSION } from "./version.js";
import {
  buildContext,
  type CommandContext,
  type GlobalOptions,
} from "./lib/context.js";
import { ExitCode, FlowclockError } from "./lib/exit.js";
import { jsonError, printJson, jsonRequested } from "./lib/output.js";
import { runStart } from "./commands/start.js";
import { runLog } from "./commands/log.js";
import { runStats } from "./commands/stats.js";
import { runHistory } from "./commands/history.js";
import { runConfig, type ConfigAction } from "./commands/config.js";
import { runDoctor } from "./commands/doctor.js";
import { runManifest } from "./commands/manifest.js";
import { runMcp } from "./commands/mcp.js";

function toInt(value: string): number {
  const n = Number(value);
  if (!Number.isFinite(n)) {
    throw new InvalidArgumentError("must be a number");
  }
  return n;
}

/** Attach the global flags shared by the root program and every subcommand. */
function addGlobalFlags(cmd: Command): Command {
  return cmd
    .option("--json", "machine-readable JSON envelope on stdout")
    .option("-y, --yes", "skip all prompts (non-interactive)")
    .option("--no-color", "disable ANSI color (also honors NO_COLOR)")
    .option("--config <path>", "path to an alternate config.json")
    .option("--quiet", "suppress informational stderr output")
    .option("--verbose", "extra diagnostics on stderr");
}

/**
 * Run a command handler with a built context, mapping thrown errors to the
 * stable exit codes (and the --json error envelope when requested).
 */
async function guard(
  commandName: string,
  cmd: Command,
  fn: (
    ctx: CommandContext,
  ) => void | Promise<void> | ExitCode | Promise<ExitCode>,
): Promise<void> {
  const global = cmd.optsWithGlobals() as GlobalOptions;
  try {
    const ctx = buildContext(global);
    const result = await fn(ctx);
    if (typeof result === "number" && result !== ExitCode.OK) {
      process.exitCode = result;
    }
  } catch (err) {
    const code = err instanceof FlowclockError ? err.code : ExitCode.GENERIC;
    const message = err instanceof Error ? err.message : String(err);
    if (jsonRequested(global.json)) {
      printJson(jsonError(commandName, code, message));
    } else {
      process.stderr.write(`flowclock: ${message}\n`);
    }
    process.exit(code);
  }
}

export function buildProgram(): Command {
  const program = new Command();
  program
    .name("flowclock")
    .description(
      "Flowtime count-up terminal timer (HUD, not Pomodoro) with silent session logging.",
    )
    .version(VERSION, "-V, --version", "print version");
  addGlobalFlags(program);

  // start — default command (runs when no subcommand is given).
  addGlobalFlags(
    program
      .command("start", { isDefault: true })
      .description(
        "start a Flowtime session (HUD in a TTY; --duration headless)",
      )
      .option(
        "-d, --duration <seconds>",
        "auto-stop after N active seconds",
        toInt,
      )
      .option("--label <text>", "attach a label to the session")
      .option("--no-hud", "force headless (requires --duration)")
      .action((opts, cmd: Command) =>
        guard("start", cmd, (ctx) =>
          runStart(ctx, {
            duration: opts.duration,
            label: opts.label,
            noHud: opts.hud === false,
          }),
        ),
      ),
  );

  // log
  addGlobalFlags(
    program
      .command("log")
      .description(
        "record a completed session (flags or session JSON on stdin)",
      )
      .option("-d, --duration <seconds>", "active seconds", toInt)
      .option("--start <iso>", "ISO-8601 start time")
      .option("--end <iso>", "ISO-8601 end time")
      .option("--label <text>", "session label")
      .option("--note <text>", "session note")
      .option("--tags <csv>", "comma-separated tags")
      .action((opts, cmd: Command) =>
        guard("log", cmd, (ctx) => runLog(ctx, opts)),
      ),
  );

  // stats
  addGlobalFlags(
    program
      .command("stats")
      .description("today total, count, best, average + weekly summary")
      .option("--since <iso>", "only count sessions after this ISO time")
      .action((opts, cmd: Command) =>
        guard("stats", cmd, (ctx) => runStats(ctx, opts)),
      ),
  );

  // history
  addGlobalFlags(
    program
      .command("history")
      .description("session history, newest first")
      .option("--limit <n>", "max rows", toInt)
      .option("--since <iso>", "ISO lower bound on start")
      .option("--until <iso>", "ISO upper bound on start")
      .action((opts, cmd: Command) =>
        guard("history", cmd, (ctx) => runHistory(ctx, opts)),
      ),
  );

  // config
  addGlobalFlags(
    program
      .command("config")
      .description("read/write configuration")
      .argument("<action>", "get | set | list | path")
      .argument("[key]", "config key")
      .argument("[value]", "value (for set)")
      .action(
        (
          action: string,
          key: string | undefined,
          value: string | undefined,
          _opts,
          cmd: Command,
        ) =>
          guard("config", cmd, (ctx) =>
            runConfig(
              ctx,
              action as ConfigAction,
              [key, value].filter((a): a is string => a !== undefined),
            ),
          ),
      ),
  );

  // doctor
  addGlobalFlags(
    program
      .command("doctor")
      .description("verify installation and environment health")
      .action((_opts, cmd: Command) =>
        guard("doctor", cmd, (ctx) => runDoctor(ctx)),
      ),
  );

  // manifest
  addGlobalFlags(
    program
      .command("manifest")
      .description("emit the command/tool manifest for agent discovery")
      .action((_opts, cmd: Command) =>
        guard("manifest", cmd, (ctx) => runManifest(ctx)),
      ),
  );

  // mcp
  addGlobalFlags(
    program
      .command("mcp")
      .description("start an MCP stdio server exposing flowclock tools")
      .action((_opts, cmd: Command) => guard("mcp", cmd, () => runMcp())),
  );

  return program;
}

export async function main(argv: string[] = process.argv): Promise<void> {
  const program = buildProgram();
  await program.parseAsync(argv);
}

// Entry point.
main().catch((err) => {
  process.stderr.write(`flowclock: ${(err as Error).message}\n`);
  process.exit(ExitCode.GENERIC);
});
