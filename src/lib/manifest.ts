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
          "Start a Flowtime session. Interactive HUD in a TTY; headless timed session with --duration.",
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
            name: "--no-hud",
            type: "boolean",
            description: "Force headless (requires --duration).",
          },
        ],
        jsonData: "The logged Session record.",
        examples: ["flowclock start", "flowclock start --duration 1500 --json"],
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
        ],
        jsonData: "The stored Session record.",
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
          "StatsSummary { todayTotalS, todayCount, allTimeTotalS, allTimeCount, bestSessionS, averageSessionS, week[] }.",
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
        name: "mcp",
        summary:
          "Start an MCP (Model Context Protocol) stdio server exposing flowclock tools.",
        jsonData: "n/a (long-running stdio server).",
        examples: ["flowclock mcp"],
      },
    ],
  };
}
