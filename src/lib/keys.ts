/// <reference types="node" />

export interface KeyHandlers {
  onPause: () => void;
  onReset: () => void;
  /** Called for `q` and Ctrl-C alike — both are a normal stop+log. */
  onQuit: () => void;
  /** Toggle break on/off (`b` by default). */
  onBreak: () => void;
  /** Cycle break category while on break (`c` by default). */
  onCategory: () => void;
  /** Digit 1–6 pressed (pick break category or start categorized break). */
  onDigit: (n: number) => void;
}

export interface Keybindings {
  pause: string;
  reset: string;
  quit: string;
  break: string;
  category: string;
}

const CTRL_C = "\u0003"; // Ctrl-C

/**
 * Read single keypresses from a raw-mode stdin and dispatch to handlers.
 * Invisible controls: nothing is echoed. Returns a `stop()` that restores the
 * terminal (raw mode off). Caller is responsible for cursor restore.
 */
export function startKeyReader(
  input: NodeJS.ReadStream,
  bindings: Keybindings,
  handlers: KeyHandlers,
): () => void {
  const wasRaw = input.isRaw ?? false;

  if (input.isTTY) input.setRawMode(true);
  input.resume();
  input.setEncoding("utf8");

  const onData = (chunk: string) => {
    for (const ch of chunk) {
      if (ch === CTRL_C || ch === bindings.quit) {
        handlers.onQuit();
        return;
      }
      if (ch === bindings.pause) handlers.onPause();
      else if (ch === bindings.reset) handlers.onReset();
      else if (ch === bindings.break) handlers.onBreak();
      else if (ch === bindings.category) handlers.onCategory();
      else if (ch >= "1" && ch <= "6") handlers.onDigit(Number(ch));
    }
  };

  input.on("data", onData);

  return function stop() {
    input.off("data", onData);
    if (input.isTTY) input.setRawMode(wasRaw);
    input.pause();
  };
}

/**
 * Read a single yes/no keypress for the end-of-session goal prompt.
 * Resolves `true` on y/Y, `false` on n/N, and `null` on any other key, Enter,
 * Ctrl-C, or after `timeoutMs` (skip = neutral, never blocks a quit). Leaves the
 * terminal raw mode the way it found it.
 */
export function readGoalOutcome(
  input: NodeJS.ReadStream,
  opts: { timeoutMs: number } = { timeoutMs: 3000 },
): Promise<boolean | null> {
  return new Promise((resolve) => {
    const wasRaw = input.isRaw ?? false;
    let done = false;

    const finish = (value: boolean | null) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      input.off("data", onData);
      if (input.isTTY) input.setRawMode(wasRaw);
      input.pause();
      resolve(value);
    };

    const onData = (chunk: string) => {
      const ch = chunk[0] ?? "";
      if (ch === "y" || ch === "Y") finish(true);
      else if (ch === "n" || ch === "N") finish(false);
      else finish(null); // Enter, Ctrl-C, anything else → skip
    };

    if (input.isTTY) input.setRawMode(true);
    input.resume();
    input.setEncoding("utf8");
    input.on("data", onData);
    const timer = setTimeout(() => finish(null), opts.timeoutMs);
  });
}
