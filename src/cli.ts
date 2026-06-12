import { Command, InvalidArgumentError } from "commander";
import { VERSION } from "./version.js";
import {
  buildContext,
  type CommandContext,
  type GlobalOptions,
} from "./lib/context.js";
import { ExitCode, FlowclockError, fail } from "./lib/exit.js";
import { jsonError, printJson, jsonRequested } from "./lib/output.js";
import { runStart } from "./commands/start.js";
import { parseDurationToS } from "./lib/format.js";
import { runLog } from "./commands/log.js";
import { runEdit } from "./commands/edit.js";
import { runStats } from "./commands/stats.js";
import { runHistory } from "./commands/history.js";
import { runGoals } from "./commands/goals.js";
import { runSummary } from "./commands/summary.js";
import { runCompletion } from "./commands/completion.js";
import { runConfig, type ConfigAction } from "./commands/config.js";
import { runDoctor } from "./commands/doctor.js";
import { runManifest } from "./commands/manifest.js";
import { runMcp } from "./commands/mcp.js";
import { runDashboard } from "./commands/dashboard.js";

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

  // start — launches the Flowtime session (routes to dashboard in a TTY).
  addGlobalFlags(
    program
      .command("start")
      .description(
        "start a Flowtime session (dashboard in a TTY; --bare for standalone HUD; --duration headless)",
      )
      .option(
        "-d, --duration <seconds>",
        "auto-stop after N active seconds",
        toInt,
      )
      .option("--label <text>", "attach a label to the session")
      .option("--goal <text>", "name the goal/intention for this session")
      .option("--theme <name>", "theme override: neon|amber|blue|mono")
      .option("--big", "render the time in big ASCII (7-segment)")
      .option("--no-hud", "force headless (requires --duration)")
      .option("--target <dur>", "focus target, e.g. 1h or 90m")
      .option("--break-budget <dur>", "break budget, e.g. 20m")
      .option("--zen", "minimal HUD: clock only, no controls footer")
      .option("--bare", "standalone HUD without the dashboard")
      .action((opts, cmd: Command) =>
        guard("start", cmd, (ctx) => {
          let target: number | undefined;
          let breakBudget: number | undefined;

          if (opts.target !== undefined) {
            try {
              target = parseDurationToS(opts.target as string);
            } catch {
              fail(ExitCode.USAGE, `invalid --target: ${opts.target as string} (use forms like 1h, 90m, 3600)`);
            }
          }

          if (opts.breakBudget !== undefined) {
            try {
              breakBudget = parseDurationToS(opts.breakBudget as string);
            } catch {
              fail(ExitCode.USAGE, `invalid --break-budget: ${opts.breakBudget as string} (use forms like 20m, 1200)`);
            }
          }

          return runStart(ctx, {
            duration: opts.duration,
            label: opts.label,
            goal: opts.goal,
            theme: opts.theme,
            big: opts.big,
            noHud: opts.hud === false,
            target,
            breakBudget,
            zen: opts.zen as boolean | undefined,
            bare: opts.bare as boolean | undefined,
          });
        }),
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
      .option("--goal <text>", "goal/intention for this session")
      .option("--recmp3-session-id <id>", "correlating recmp3-cli session id")
      .option("--target <dur>", "focus target, e.g. 1h or 90m")
      .option("--break-budget <dur>", "break budget, e.g. 20m")
      .action((opts, cmd: Command) =>
        guard("log", cmd, (ctx) => {
          let focusTargetS: number | undefined;
          let breakBudgetS: number | undefined;

          if (opts.target !== undefined) {
            try {
              focusTargetS = parseDurationToS(opts.target as string);
            } catch {
              fail(ExitCode.USAGE, `invalid --target: ${opts.target as string} (use forms like 1h, 90m, 3600)`);
            }
          }

          if (opts.breakBudget !== undefined) {
            try {
              breakBudgetS = parseDurationToS(opts.breakBudget as string);
            } catch {
              fail(ExitCode.USAGE, `invalid --break-budget: ${opts.breakBudget as string} (use forms like 20m, 1200)`);
            }
          }

          return runLog(ctx, { ...opts, focusTargetS, breakBudgetS });
        }),
      ),
  );

  // edit — surgically edit a logged session's essential values.
  addGlobalFlags(
    program
      .command("edit")
      .description(
        "edit a logged session (focus/break/goal/name); end + timeline recompute automatically",
      )
      .argument("<id>", "session id (or a unique id prefix)")
      .option("--focus <dur>", "new active focus time, e.g. 1h30m, 90m, 45s")
      .option("--break <dur>", "new total break time, e.g. 20m (0 clears breaks)")
      .option("--goal <text>", "new goal/intention (empty string clears)")
      .option("--name <text>", "new session name/label (empty string clears)")
      .action((id: string, opts, cmd: Command) =>
        guard("edit", cmd, (ctx) => {
          let focusS: number | undefined;
          let breakS: number | undefined;

          if (opts.focus !== undefined) {
            try {
              focusS = parseDurationToS(opts.focus as string);
            } catch {
              fail(ExitCode.USAGE, `invalid --focus: ${opts.focus as string} (use forms like 1h30m, 90m, 45s)`);
            }
          }
          if (opts.break !== undefined) {
            try {
              breakS = parseDurationToS(opts.break as string);
            } catch {
              fail(ExitCode.USAGE, `invalid --break: ${opts.break as string} (use forms like 20m, 0)`);
            }
          }

          return runEdit(ctx, id, {
            focusS,
            breakS,
            goal: opts.goal as string | undefined,
            name: opts.name as string | undefined,
          });
        }),
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

  // summary
  addGlobalFlags(
    program
      .command("summary")
      .description("markdown table of a week's sessions (for notes)")
      .option("--week <YYYY-WW>", "ISO week to summarize (default: this week)")
      .action((opts, cmd: Command) =>
        guard("summary", cmd, (ctx) => runSummary(ctx, opts)),
      ),
  );

  // goals
  addGlobalFlags(
    program
      .command("goals")
      .description("your goals, learned from logged sessions (with hit/miss)")
      .action((_opts, cmd: Command) =>
        guard("goals", cmd, (ctx) => runGoals(ctx)),
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

  // completion
  addGlobalFlags(
    program
      .command("completion")
      .description("print a shell completion script (bash|zsh|fish)")
      .argument("<shell>", "bash | zsh | fish")
      .action((shell: string, _opts, cmd: Command) =>
        guard("completion", cmd, (ctx) => runCompletion(ctx, shell)),
      ),
  );

  // mcp
  addGlobalFlags(
    program
      .command("mcp")
      .description("start an MCP stdio server exposing flowclock tools")
      .action((_opts, cmd: Command) => guard("mcp", cmd, () => runMcp())),
  );

  // dashboard — default command (runs when no subcommand is given).
  addGlobalFlags(
    program
      .command("dashboard", { isDefault: true })
      .aliases(["dash", "tui"])
      .description(
        "open the interactive Flowtime dashboard (TUI; --json for a snapshot)",
      )
      .option("--view <name>", "open on a view: session|overview|sessions|goals|breaks|help")
      .action((opts, cmd: Command) =>
        guard("dashboard", cmd, (ctx) => runDashboard(ctx, { view: opts.view as string | undefined })),
      ),
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
