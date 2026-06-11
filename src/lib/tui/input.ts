/**
 * Pure key parser + raw-mode reader wrapper for TUI navigation.
 *
 * `parseKey` is pure and fully unit-testable. `startNavReader` mirrors the
 * `startKeyReader` pattern in `keys.ts` but dispatches structured Key values
 * rather than calling per-action handlers.
 */

/// <reference types="node" />

// ---------------------------------------------------------------------------
// Key type
// ---------------------------------------------------------------------------

export type Key =
  | { name: "up" }
  | { name: "down" }
  | { name: "left" }
  | { name: "right" }
  | { name: "enter" }
  | { name: "tab" }
  | { name: "escape" }
  | { name: "backspace" }
  | { name: "delete" }
  | { name: "home" }
  | { name: "end" }
  | { name: "char"; char: string };

// ---------------------------------------------------------------------------
// Pure key parser
// ---------------------------------------------------------------------------

// Common escape sequences
const SEQUENCES: Record<string, Key> = {
  "\x1b[A": { name: "up" },
  "\x1b[B": { name: "down" },
  "\x1b[C": { name: "right" },
  "\x1b[D": { name: "left" },
  // Application-mode cursor keys
  "\x1bOA": { name: "up" },
  "\x1bOB": { name: "down" },
  "\x1bOC": { name: "right" },
  "\x1bOD": { name: "left" },
  // Home / End
  "\x1b[H": { name: "home" },
  "\x1b[F": { name: "end" },
  "\x1b[1~": { name: "home" },
  "\x1b[4~": { name: "end" },
  "\x1b[7~": { name: "home" },
  "\x1b[8~": { name: "end" },
  // Delete / "Supr" (forward delete)
  "\x1b[3~": { name: "delete" },
};

const CTRL_C = "";

/**
 * Parse a raw terminal chunk into a structured Key.
 *
 * Handles:
 *   - Arrow keys (`\x1b[A/B/C/D`, `\x1bOA/B/C/D`)
 *   - Enter (`\r` or `\n`)
 *   - Tab (`\t`)
 *   - Escape (bare `\x1b`)
 *   - Backspace (`\x7f`)
 *   - Home / End (various sequences)
 *   - Ctrl-C → `{ name: "char", char: "" }`
 *   - Any other printable character → `{ name: "char", char }`
 */
export function parseKey(chunk: string): Key {
  // Lookup multi-char sequences first
  const seq = SEQUENCES[chunk];
  if (seq) return seq;

  // Single-char cases
  if (chunk === "\r" || chunk === "\n") return { name: "enter" };
  if (chunk === "\t") return { name: "tab" };
  if (chunk === "\x7f") return { name: "backspace" };
  if (chunk === "\x1b") return { name: "escape" };

  // Ctrl-C: treat as a char so the app can decide to quit
  if (chunk === CTRL_C) return { name: "char", char: CTRL_C };

  // Any other input (including multi-byte UTF-8 chars) → char
  const char = chunk[0] ?? "";
  return { name: "char", char };
}

// ---------------------------------------------------------------------------
// Raw-mode reader
// ---------------------------------------------------------------------------

/**
 * Start a raw-mode key reader on `input`. Dispatches one `Key` per data
 * chunk via `onKey`. Also routes Ctrl-C to `{ name: "char", char: "" }`
 * so the caller can handle quit.
 *
 * Mirrors the pattern in `keys.ts` (`startKeyReader`):
 *   - Sets raw mode, resumes, utf8 encoding.
 *   - Returns a `stop()` function that restores raw mode + pauses.
 */
export function startNavReader(
  input: NodeJS.ReadStream,
  onKey: (k: Key) => void,
): () => void {
  const wasRaw = (input as NodeJS.ReadStream & { isRaw?: boolean }).isRaw ?? false;

  if (input.isTTY) input.setRawMode(true);
  input.resume();
  input.setEncoding("utf8");

  const onData = (chunk: string) => {
    onKey(parseKey(chunk));
  };

  input.on("data", onData);

  return function stop() {
    input.off("data", onData);
    if (input.isTTY) input.setRawMode(wasRaw);
    input.pause();
  };
}
