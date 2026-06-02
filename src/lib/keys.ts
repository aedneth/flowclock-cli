/// <reference types="node" />

export interface KeyHandlers {
  onPause: () => void;
  onReset: () => void;
  /** Called for `q` and Ctrl-C alike — both are a normal stop+log. */
  onQuit: () => void;
}

export interface Keybindings {
  pause: string;
  reset: string;
  quit: string;
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
    }
  };

  input.on("data", onData);

  return function stop() {
    input.off("data", onData);
    if (input.isTTY) input.setRawMode(wasRaw);
    input.pause();
  };
}
