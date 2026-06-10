import { VERSION } from "../version.js";
import { ExitCode, EXIT_CODE_NAME } from "./exit.js";

export interface FlagSpec {
  name: string;
  type: "boolean" | "string" | "number";
  description: string;
  env?: string;
}

export interface CommandSpec {
  name: string;
  summary: string;
  args?: string[];
  flags?: FlagSpec[];
  /** Description of the `data` field shape returned under --json. */
  jsonData: string;
  examples?: string[];
}

export interface Manifest {
  name: string;
  version: string;
  description: string;
  globalFlags: FlagSpec[];
  exitCodes: { code: number; name: string; description: string }[];
  commands: CommandSpec[];
}

const GLOBAL_FLAGS: FlagSpec[] = [
  {
    name: "--json",
    type: "boolean",
    description: "Machine-readable JSON envelope on stdout.",
    env: "FLOWCLOCK_JSON",
  },
  {
    name: "--yes",
    type: "boolean",
    description: "Skip all prompts (non-interactive).",
    env: "FLOWCLOCK_YES",
  },
  {
    name: "--no-color",
    type: "boolean",
    description: "Disable ANSI color (also honors NO_COLOR).",
  },
  {
    name: "--config",
    type: "string",
    description: "Path to an alternate config.json.",
  },
  {
    name: "--quiet",
    type: "boolean",
    description: "Suppress informational stderr output.",
  },
  {
    name: "--verbose",
    type: "boolean",
    description: "Extra diagnostics on stderr.",
  },
];

const EXIT_DESCRIPTIONS: Record<ExitCode, string> = {
  [ExitCode.OK]: "Success.",
  [ExitCode.GENERIC]: "Unspecified error.",
  [ExitCode.USAGE]: "Invalid arguments or usage.",
  [ExitCode.CONFIG]: "Configuration error.",
  [ExitCode.DATA]: "Session data unreadable/corrupt and unrecoverable.",
  [ExitCode.NO_TTY]: "Interactive flow required but no TTY available.",
  [ExitCode.DOCTOR]: "A doctor health check failed.",
};

/** The single source of truth for command discovery — reused by the MCP server. */
export function buildManifest(): Manifest {
  return {
    name: "flowclock",
    version: VERSION,
    description:
      "Flowtime count-up terminal timer (HUD, not Pomodoro) with silent session logging. Agent-native.",
    globalFlags: GLOBAL_FLAGS,
    exitCodes: Object.values(ExitCode)
      .filter((v): v is ExitCode => typeof v === "number")
      .map((code) => ({
        code,
        name: EXIT_CODE_NAME[code],
        description: EXIT_DESCRIPTIONS[code],
      })),
    commands: [
      {
        name: "start",
        summary:
          "Start a Flowtime session inside the dashboard's Session view (TTY). Use --bare for the standalone HUD; headless timed session with --duration.",
        flags: [
          {
            name: "--duration",
            type: "number",
            description: "Auto-stop after N active seconds.",
          },
          {
            name: "--label",
            type: "string",
            description: "Attach a label to the session.",
          },
          {
            name: "--goal",
            type: "string",
            description:
              "Name the goal/intention; prompts hit/miss at stop (TTY).",
          },
          {
            name: "--theme",
            type: "string",
            description: "Theme override for this session: neon|amber|blue|mono.",
          },
          {
            name: "--big",
            type: "boolean",
            description: "Render the time in big 7-segment ASCII.",
          },
          {
            name: "--no-hud",
            type: "boolean",
            description: "Force headless (requires --duration).",
          },
          {
            name: "--target",
            type: "string",
            description: "Focus target, e.g. 1h or 90m.",
          },
          {
            name: "--break-budget",
            type: "string",
            description: "Break budget, e.g. 20m.",
          },
          {
            name: "--zen",
            type: "boolean",
            description: "Minimal clock-only display; compact, no footer or metadata.",
          },
          {
            name: "--bare",
            type: "boolean",
            description: "Standalone HUD (bypasses the dashboard); like the old default TTY behaviour.",
          },
        ],
        jsonData:
          "The logged Session record (v3 schema): includes breaks[], breakS, focusTargetS, breakBudgetS.",
        examples: [
          "flowclock start",
          "flowclock start --goal 'Deep work' --duration 1500 --json",
          "flowclock start --target 1h --break-budget 20m",
          "flowclock start --goal 'Deep work' --target 1h --break-budget 20m --bare",
        ],
      },
      {
        name: "log",
        summary:
          "Record a completed session non-interactively (flags or session JSON on stdin).",
        flags: [
          {
            name: "--duration",
            type: "number",
            description: "Active seconds (required if no stdin).",
          },
          {
            name: "--start",
            type: "string",
            description: "ISO-8601 start time.",
          },
          { name: "--end", type: "string", description: "ISO-8601 end time." },
          { name: "--label", type: "string", description: "Session label." },
          { name: "--note", type: "string", description: "Session note." },
          {
            name: "--tags",
            type: "string",
            description: "Comma-separated tags.",
          },
          {
            name: "--goal",
            type: "string",
            description: "Goal/intention for this session.",
          },
          {
            name: "--target",
            type: "string",
            description: "Focus target, e.g. 1h or 90m.",
          },
          {
            name: "--break-budget",
            type: "string",
            description: "Break budget, e.g. 20m.",
          },
          {
            name: "--recmp3-session-id",
            type: "string",
            description: "Correlating recmp3-cli session id (naming convention).",
          },
        ],
        jsonData: "The stored Session record (v3 schema).",
        examples: ["flowclock log --duration 600 --label deep-work --json"],
      },
      {
        name: "stats",
        summary:
          "Aggregate stats: today total, count, best, average, last 7 days.",
        flags: [
          {
            name: "--since",
            type: "string",
            description: "Only count sessions after this ISO time.",
          },
        ],
        jsonData:
          "StatsSummary { todayTotalS, todayCount, allTimeTotalS, allTimeCount, bestSessionS, averageSessionS, currentStreak, longestStreak, lastSessionDate, week[], todayBreakS, allTimeBreakS } plus game { flowScore, dailyMaximizationPct, focusRestRatioToday, focusRestRatioAllTime, achievements }.",
        examples: ["flowclock stats --json"],
      },
      {
        name: "history",
        summary: "List sessions, newest first.",
        flags: [
          { name: "--limit", type: "number", description: "Max rows." },
          {
            name: "--since",
            type: "string",
            description: "ISO lower bound on start.",
          },
          {
            name: "--until",
            type: "string",
            description: "ISO upper bound on start.",
          },
        ],
        jsonData: "{ count, sessions: Session[] }.",
        examples: ["flowclock history --limit 10 --json"],
      },
      {
        name: "summary",
        summary:
          "Markdown table of a week's sessions (Date|Sessions|Total|Best|Goal|Breaks|Focus:Rest).",
        flags: [
          {
            name: "--week",
            type: "string",
            description: "ISO week YYYY-WW to summarize (default: this week).",
          },
        ],
        jsonData:
          "{ week, weekStart, days: [{ date, sessions, totalS, bestS, goal, breakS, focusRestRatio }] }.",
        examples: ["flowclock summary --week 2026-23 --json"],
      },
      {
        name: "goals",
        summary:
          "Your goals, learned from logged sessions, with hit/miss tallies.",
        jsonData:
          "{ count, goals: [{ goal, count, totalS, met, missed, neutral, lastUsed, breakS, focusTargetS, breakBudgetS }] }.",
        examples: ["flowclock goals --json"],
      },
      {
        name: "config",
        summary: "Read/write configuration.",
        args: ["<get|set|list|path>", "[key]", "[value]"],
        jsonData: "The config object, or { key, value }.",
        examples: [
          "flowclock config list --json",
          "flowclock config set theme amber",
        ],
      },
      {
        name: "doctor",
        summary: "Verify installation and environment health.",
        jsonData: "{ ok, checks: [{ name, ok, detail }] }.",
        examples: ["flowclock doctor --json"],
      },
      {
        name: "manifest",
        summary: "Emit this command/tool manifest for agent discovery.",
        jsonData: "The Manifest object.",
        examples: ["flowclock manifest --json"],
      },
      {
        name: "completion",
        summary: "Print a shell completion script (bash|zsh|fish).",
        args: ["<bash|zsh|fish>"],
        jsonData: "{ shell, script }.",
        examples: ["flowclock completion zsh"],
      },
      {
        name: "dashboard",
        summary:
          "DEFAULT command — interactive Flowtime dashboard TUI (aliases: dash, tui). Hosts live sessions, stats, goals, breaks, and help views. Requires a TTY. Use --json to emit a DashboardSnapshot for agents without a TTY.",
        flags: [
          {
            name: "--view",
            type: "string",
            description:
              "Open directly on a named view: session|overview|sessions|goals|breaks|help.",
          },
        ],
        jsonData:
          "DashboardSnapshot { generatedAt, stats: StatsSummary, game: GameSummary, goals: GoalSummary[], recent: Session[] }.",
        examples: [
          "flowclock dashboard",
          "flowclock dashboard --json",
          "flowclock dashboard --view help",
        ],
      },
      {
        name: "mcp",
        summary:
          "Start an MCP (Model Context Protocol) stdio server exposing flowclock tools.",
        jsonData: "n/a (long-running stdio server).",
        examples: ["flowclock mcp"],
      },
    ],
  };
}
