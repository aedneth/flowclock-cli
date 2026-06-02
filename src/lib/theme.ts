import type { ThemeName } from "../schemas/config.js";

/** Raw ANSI SGR foreground codes per theme. */
const THEME_FG: Record<ThemeName, string> = {
  neon: "\x1b[38;5;46m", // bright green
  amber: "\x1b[38;5;214m",
  blue: "\x1b[38;5;39m",
  mono: "\x1b[37m",
};

const RESET = "\x1b[0m";

/**
 * Decide whether color should be emitted. Honors the NO_COLOR convention and an
 * explicit override, and defaults off when stdout is not a TTY (agent-friendly).
 */
export function colorEnabled(opts: {
  noColor?: boolean;
  isTTY?: boolean;
  env?: NodeJS.ProcessEnv;
}): boolean {
  const env = opts.env ?? process.env;
  if (opts.noColor) return false;
  if (env.NO_COLOR !== undefined && env.NO_COLOR !== "") return false;
  if (env.FLOWCLOCK_NO_COLOR) return false;
  return opts.isTTY ?? false;
}

/** Wrap text in the theme color, or return it unchanged when color is off. */
export function paint(
  text: string,
  theme: ThemeName,
  enabled: boolean,
): string {
  if (!enabled) return text;
  return `${THEME_FG[theme]}${text}${RESET}`;
}

export { THEME_FG, RESET };
