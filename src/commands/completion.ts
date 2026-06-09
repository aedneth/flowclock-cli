import type { CommandContext } from "../lib/context.js";
import { buildManifest } from "../lib/manifest.js";
import { jsonSuccess, printJson } from "../lib/output.js";
import { ExitCode, fail } from "../lib/exit.js";

export const SUPPORTED_SHELLS = ["bash", "zsh", "fish"] as const;
export type Shell = (typeof SUPPORTED_SHELLS)[number];

/** Detect the user's shell from $SHELL, or null if unknown/unsupported. */
export function detectShell(env: NodeJS.ProcessEnv = process.env): Shell | null {
  const sh = (env.SHELL ?? "").split("/").pop() ?? "";
  return SUPPORTED_SHELLS.includes(sh as Shell) ? (sh as Shell) : null;
}

interface CommandInfo {
  name: string;
  summary: string;
}

/** Subcommands to complete — the single source of truth is the manifest. */
function commandInfos(): CommandInfo[] {
  return buildManifest().commands.map((c) => ({
    name: c.name,
    summary: c.summary,
  }));
}

// Note: these are plain (non-template) JS strings so the shell's own `${...}`,
// `$(...)`, and `$var` syntax passes through literally with zero escaping.
function bashScript(): string {
  const names = commandInfos()
    .map((c) => c.name)
    .join(" ");
  return [
    '# flowclock bash completion — eval "$(flowclock completion bash)"',
    "_flowclock() {",
    '  local cur="${COMP_WORDS[COMP_CWORD]}"',
    '  local cmds="' + names + '"',
    '  local globals="--json --yes --no-color --config --quiet --verbose --help --version"',
    '  if [ "$COMP_CWORD" -eq 1 ]; then',
    '    COMPREPLY=( $(compgen -W "$cmds" -- "$cur") )',
    "  else",
    '    COMPREPLY=( $(compgen -W "$globals" -- "$cur") )',
    "  fi",
    "}",
    "complete -F _flowclock flowclock",
    "",
  ].join("\n");
}

function zshScript(): string {
  const cmds = commandInfos()
    .map((c) => "    '" + c.name + ":" + c.summary.replace(/'/g, "") + "'")
    .join("\n");
  return [
    "#compdef flowclock",
    '# flowclock zsh completion — flowclock completion zsh > "${fpath[1]}/_flowclock"',
    "_flowclock() {",
    "  local -a cmds",
    "  cmds=(",
    cmds,
    "  )",
    "  _arguments '1: :->command' '*::arg:->args'",
    "  case $state in",
    "    command) _describe 'flowclock command' cmds ;;",
    "  esac",
    "}",
    '_flowclock "$@"',
    "",
  ].join("\n");
}

function fishScript(): string {
  const subs = "start log stats history summary goals config doctor dashboard manifest mcp completion";
  const lines = commandInfos()
    .map(
      (c) =>
        `complete -c flowclock -n "__fish_use_subcommand" -a ${c.name} -d "${c.summary.replace(/"/g, "")}"`,
    )
    .join("\n");
  return `# flowclock fish completion — flowclock completion fish > ~/.config/fish/completions/flowclock.fish
complete -c flowclock -f
${lines}
complete -c flowclock -l json -d "machine-readable JSON envelope"
complete -c flowclock -l no-color -d "disable ANSI color"
complete -c flowclock -l yes -d "skip prompts"
# subcommands: ${subs}
`;
}

const GENERATORS: Record<Shell, () => string> = {
  bash: bashScript,
  zsh: zshScript,
  fish: fishScript,
};

/** `flowclock completion <bash|zsh|fish>` — print a sourceable script. */
export function runCompletion(ctx: CommandContext, shell: string): void {
  if (!SUPPORTED_SHELLS.includes(shell as Shell)) {
    fail(
      ExitCode.USAGE,
      `unsupported shell '${shell}' (expected: ${SUPPORTED_SHELLS.join("|")})`,
    );
  }
  const script = GENERATORS[shell as Shell]();
  if (ctx.json) {
    printJson(jsonSuccess("completion", { shell, script }));
    return;
  }
  process.stdout.write(script);
}
